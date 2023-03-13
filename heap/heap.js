import * as THREE from 'three';
import fontData from 'three/fonts/droid_sans_mono_regular.typeface.json' assert { type: "json" };
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { Interaction } from './three.interaction.js/src/index.js';
import { TWEEN } from 'tween';

const font = new FontLoader().parse( fontData );
const frustumSize = 250;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, 
                                             frustumSize * aspect / 2, 
                                             frustumSize / 2, 
                                             frustumSize / - 2, 1, 1000 );
camera.position.z = 50;
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xffffff );

const light = new THREE.AmbientLight( 0xffffff );
scene.add( light );

// Set up the renderer
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const interaction = new Interaction(renderer, scene, camera);

const colors = { 
    'viridis': d3.interpolateViridis, 
    'magma': d3.interpolateMagma,
    'inferno': d3.interpolateInferno,
    'plasma': d3.interpolatePlasma,
    'cividis': d3.interpolateCividis,
    'warm': d3.interpolateWarm,
    'cool': d3.interpolateCool,
    'rainbow': d3.interpolateRainbow
}
var colorFormat = 'viridis';

// params for tree and array node positions
const treeXStart = 0;
const treeYStart = 100;
const aryY = -100;
const maxAryWidth = frustumSize * aspect * .9; 
const textDeltaZ = 5; // shift text forward so visible
const boxZ = -100;    // z location of the boxes

// modifable params - levels, number of elements, and colors / level in the heap, boxDim - size of x,y,z for box..
var numLevels = 4;
var heapSize = Math.pow(2, numLevels) - 1;
var levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
var boxDim = 16;
var lineColor = 0x000000;
var txtColor = 0xffffff;
var aryDeltaX = maxAryWidth / ( heapSize + 1 );
var aryXStart = -maxAryWidth / 2 + aryDeltaX / 2;

while ( aryDeltaX < boxDim ) {
    boxDim *= 0.75; 
}

var textSize = boxDim / 2;
var textHeight = textSize - 1; 
var algoSpeed = 1;
var algoStatus = 'stopped';
var pauseControllerObj;

// Define a function to create a single node
function createNode( x, y, z, level ) {
    const geometry = new THREE.BoxGeometry(boxDim, boxDim, 1);
    const material = new THREE.MeshStandardMaterial({   
                                                        color: level == 0xd3d3d3 ? level : levelColors[level], 
                                                        opacity: 1, 
                                                        transparent: false,
                                                        polygonOffset: true,
                                                        polygonOffsetFactor: 1, // positive value pushes polygon further away
                                                        polygonOffsetUnits: 1, 
                                                    });

    const node = new THREE.Mesh( geometry, material );
    node.position.set(x, y, z);
    
    // selector box for the node - hide at first
    const offset = boxDim / 2;
    const zPos = boxZ + 5;
    const positions = [ -offset,  offset, zPos,   // left top
                         offset,  offset, zPos,   // right top
                         offset, -offset, zPos,   // right bottom
                        -offset, -offset, zPos,   // left bottom
                        -offset,  offset, zPos ]; 
    
    const lineGeo = new LineGeometry();
    lineGeo.setPositions( positions );

    const lineMat = new LineMaterial( { color: 0xd44842, linewidth: 0.005 } ); // not sure why so small, but it works.
    const lineMesh = new Line2( lineGeo, lineMat );
    lineMesh.visible = false;

    node.add( lineMesh );

    node.userData.level = level;

    scene.add( node );
    
    return node;
}

function createTextMesh( num, x, y, z, format ) {
    // make text - although the text object is NOT a child of the node, it's
    // convienent to create it here; add it to the scene. 
    let nstr = num.toString();
    if (num < 10) nstr = '0' + nstr; // pad with 0

    let tsize = textSize;
    let theight = textHeight;
    let tcolor = txtColor;
    let bevelThick = 0.5;
    let bevelSize = 0.5;
    if ( format == "arrayNums" ) {
        tsize /= 2;
        theight /= 2;
        tcolor = 0x000000;
        bevelThick /= 2;
        bevelSize /= 2;
    }

    const textGeo = new TextGeometry( nstr, {
                                                font: font,
                                                size: tsize,
                                                height: theight,
                                                curveSegments: 12,
                                                bevelEnabled: true,
                                                bevelThickness: bevelThick,
                                                bevelSize: bevelSize,
                                                bevelOffset: 0,
                                                bevelSegments: 5
                                            });
            
    textGeo.computeBoundingBox();
    const textMat = [ new THREE.MeshBasicMaterial( { color: tcolor } ), new THREE.MeshBasicMaterial( { color: lineColor } ) ] ;
    const textMesh = new THREE.Mesh( textGeo, textMat );
    const textCenter = textGeo.boundingBox.getCenter( new THREE.Vector3() );

    let textY = format == "arrayNums" ? y : y - textCenter.y;

    textMesh.position.set( x - textCenter.x, textY, z + textDeltaZ );
    textMesh.name = num.toString() + '_' + format;
    scene.add( textMesh );

    return textMesh;
}

// given a node, toggles the box around it; assumes box is first child
const toggleBoxes = ( nodeIdx ) => {
    treeNodes[ nodeIdx ].children[0].visible = !treeNodes[ nodeIdx ].children[0].visible;
    aryNodes[ nodeIdx + 1 ].children[0].visible = !aryNodes[nodeIdx + 1].children[0].visible;
}

var heap = [];
var treeNodes = [];
var aryNodes = [];
var lines = [];

function initHeap() {

    // clear objects from scene
    treeNodes.forEach(node => scene.remove(node));
    aryNodes.forEach(node => scene.remove(node));
    lines.forEach(line => scene.remove(line));
    treeNodes = [];
    aryNodes = [];
    lines = [];

    // clear text meshes
    for ( let elem of heap ) {
        for ( let format of [ 'tree', 'array' ]) {
            scene.remove( scene.getObjectByName( elem.toString() + '_' + format ) );
        }
    }

    // actually create the heap.
    heap = [ "\u00D8" ];
    while ( heap.length < heapSize + 1 ) {
        const r = Math.floor( Math.random() * 100 );
        if ( heap.indexOf(r) === -1 ) heap.push( r );
    }
    
    // initialize the nodes for the tree and array
    treeNodes = [ createNode( treeXStart, treeYStart, boxZ, 0 ) ];
    aryNodes  = [ createNode( aryXStart, aryY, boxZ, 0xd3d3d3 ) ]; // null box color

    createTextMesh( heap[1], treeXStart, treeYStart, boxZ, 'tree' );
    createTextMesh( heap[0], aryXStart, aryY, boxZ, 'array' );
    createTextMesh( 0, aryXStart, aryY + boxDim / 2, boxZ, 'arrayNums' );

    for ( let i = 1; i < heapSize + 1; i++ ) {
        
        if ( i < heapSize ) {
            const levelNum = Math.floor( Math.log2( i + 1 ) );
            const parentIndex = Math.floor( (i - 1) / 2 );
            const parent = treeNodes[ parentIndex ];
            const isLeft = i % 2 !== 0;

            const treeX = parent.position.x + (isLeft ? -100 : 100) * Math.pow(0.5, levelNum - 1);
            const treeY = parent.position.y - 30;
            const treeNode = createNode( treeX, treeY, boxZ, levelNum );
            treeNodes.push(treeNode);

            createTextMesh( heap[i + 1], treeX, treeY, boxZ, 'tree' );
        }

        const levelNum = Math.floor( Math.log2( i ) );
        const aryX = aryXStart + i * aryDeltaX;
        const aryNodeLo = createNode( aryX, aryY, boxZ, levelNum );
        aryNodes.push(aryNodeLo);

        createTextMesh( heap[i], aryX, aryY, boxZ, 'array' );
        createTextMesh( i, aryX, aryY + boxDim / 2, boxZ, 'arrayNums' );

    }

    // lines connecting the nodes
    for (let i = 1; i < heapSize; i++) {
        const levelNum = Math.floor( Math.log2( i + 1 ) );
        
        const curr = treeNodes[i];
        const parent = treeNodes[ Math.floor( ( i - 1 ) / 2 ) ];
        
        const geo = new LineGeometry();
        geo.setPositions( [ ...curr.position.toArray(), ...parent.position.toArray() ] );

        // sizing is off b/c of angles on lines; this fixes the problem. 
        const mat = new LineMaterial( { 
                                        color: lineColor,
                                        linewidth: 0.003 * Math.pow( 0.85, levelNum - 1 )
                                       } ); // not sure why so small, but it works.
        const line = new Line2( geo, mat );
        
        scene.add( line );
        lines.push( line );
    }
    
}

async function toggleNodes(nodeList, onTime=2000*algoSpeed, offTime=300*algoSpeed) {
    if ( algoStatus === "paused" ) await pause();
    nodeList.forEach(nodeIdx => toggleBoxes(nodeIdx));
    await new Promise((resolve) => setTimeout(resolve, onTime));
    if ( algoStatus === "paused" ) await pause();
    nodeList.forEach(nodeIdx => toggleBoxes(nodeIdx));
    await new Promise((resolve) => setTimeout(resolve, offTime));
}

// given two points, return a point that is d along a vector perpendicular to the line formed by the original two points
// where d is half the distance between p1 and p2
const perp = (p1, p2) => {
    const d = Math.sqrt( Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) );
    const midP = new THREE.Vector2( (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    let perpVec; //= new THREE.Vector2( p1.y - p2.y, p2.x - p1.x );
    if ( p1.x > p2.x ) 
        perpVec = new THREE.Vector2( p2.y - p1.y, p1.x - p2.x );
    else 
        perpVec = new THREE.Vector2( p1.y - p2.y, p2.x - p1.x );
    perpVec.normalize().multiplyScalar(d);
    return midP.add(perpVec);
}

const tweenSwap = ( obj1 , obj2, scale = 1 ) => {
    const bezP = perp(obj1.position, obj2.position);
    for ( const [a, b] of [ [obj1, obj2], [obj2, obj1] ] ) {
        new TWEEN.Tween(a.position).to( {
            x: [ bezP.x * scale, b.position.x ], 
            y: [ bezP.y * scale, b.position.y ]
        }, 1000).interpolation(TWEEN.Interpolation.Bezier).start();
    }
}

async function swap(childIdx, parentIdx) {

    const numChild = heap[ childIdx + 1 ];
    const numParent = heap[ parentIdx + 1 ];

    const childTreeText = scene.getObjectByName(numChild.toString() + "_tree");
    const parentTreeText = scene.getObjectByName(numParent.toString() + "_tree");
    tweenSwap(childTreeText, parentTreeText);

    const childAryText = scene.getObjectByName(numChild.toString() + "_array");
    const parentAryText = scene.getObjectByName(numParent.toString() + "_array");
    tweenSwap(parentAryText, childAryText, 0.25);

    heap[ childIdx + 1 ] = numParent;
    heap[ parentIdx + 1 ] = numChild;
                                                            
}

async function reHeapDown( parentIdx ) {
    const leftIdx = 2 * parentIdx + 1;
    const rightIdx = 2 * parentIdx + 2;
    if ( leftIdx >= heapSize ) return; // no children (leaf) - assume heap always full.
    await compare(leftIdx, parentIdx, rightIdx);
}

async function compare(currIdx, parentIdx, siblingIdx) {
    const currNum = heap[ currIdx + 1 ];
    const parentNum = heap[ parentIdx + 1 ];
    const siblingNum = heap[ siblingIdx + 1 ];
    
    await toggleNodes( [ currIdx ] );
    await toggleNodes( [ siblingIdx ] );
    await toggleNodes( [ parentIdx ] );
    
    if ( currNum < siblingNum && currNum < parentNum ) {
        await toggleNodes( [ currIdx, parentIdx ] );
        await swap(currIdx, parentIdx);
        await reHeapDown( currIdx );
    }else if ( siblingNum < parentNum && siblingNum < parentNum ) {
        await toggleNodes( [ siblingIdx, parentIdx ] );
        await swap(siblingIdx, parentIdx);
        await reHeapDown( siblingIdx );
    }
}

async function pause() {
    while ( algoStatus === "paused" ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function buildHeap() {
    for (let i = heapSize - 1; i > 0; i -= 2) {
        const parentIdx = Math.floor( ( i - 1 ) / 2 );
        const siblingIdx = i % 2 === 0 ? i - 1 : i + 1;
        await compare(i, parentIdx, siblingIdx);
        if ( algoStatus === "paused" ) await pause();
    }
    algoStatus = "stopped";
}

function makeClicky(obj) {
    obj.cursor = "pointer";
    obj.on('click', function() {
        console.log("clicked");
    });
    // determine which box the object is in; make it's highlight box on. 
    // if you've clicked two, swap them. 
    // validate that the swap is correct. 
}

async function tryBuild() {
    for ( let elem of heap ) {
        for ( let format of [ 'tree', 'array' ]) {
           const node = scene.getObjectByName( elem.toString() + '_' + format );
           if ( node === undefined ) continue;
           makeClicky(node);
        }
    }
    treeNodes.forEach( node => makeClicky(node) );
    aryNodes.forEach( node => makeClicky(node) );


}

function initGui() {

    const gui = new GUI();
    gui.name = "gui";

    const param = {
        'num levels': 4,
        'palette': 'viridis',
        'width': 5,
        'txtColor': "#ffffff",
        'lineColor': "#000000",
        'algo speed': 1
    };

    gui.add( param, 'num levels', 2, 6, 1).onChange( function ( val ) {
        if (numLevels == val || algoStatus !== "stopped" ) return;
        numLevels = val;

        boxDim = 16; // always reset it

        // heap is about to change, so remove old heap objects
        for ( let i of Array(heapSize + 1).keys()) {
            scene.remove( scene.getObjectByName( i.toString() + '_arrayNums' ) );
        }

        heapSize = Math.pow(2, numLevels) - 1;
        levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
        
        aryDeltaX = maxAryWidth / ( heapSize + 1 );
        aryXStart = -maxAryWidth / 2 + aryDeltaX / 2;

        while ( aryDeltaX < boxDim ) {
            boxDim *= 0.75; 
        }
        textSize = boxDim / 2;
        textHeight = textSize - 1; 
        
        initHeap();
    });

    gui.add( param, 'palette', Object.keys(colors), 'viridis' ).onChange( function ( val ) {
        colorFormat = val;
        levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
        treeNodes.forEach(node => node.material.color = new THREE.Color(node.userData.level == 0xd3d3d3 ? 0xd3d3d3 : levelColors[node.userData.level]));
        aryNodes.forEach(node => node.material.color = new THREE.Color(node.userData.level == 0xd3d3d3 ? 0xd3d3d3 : levelColors[node.userData.level]));
    }); 

    gui.addColor( param, 'txtColor' ).onChange( function ( val ) {
        val = val.replace('#', '');    
        val = "rgb(" + parseInt(val.substring(0, 2), 16).toString() + "," + 
                       parseInt(val.substring(2, 4), 16).toString() + "," + 
                       parseInt(val.substring(4, 6), 16).toString() + ")";
        if (txtColor == val) return;
        txtColor = val;

        for ( let elem of heap ) {
            for ( let format of [ 'tree', 'array' ]) {
                const txtMesh = scene.getObjectByName( elem.toString() + '_' + format );
                if ( txtMesh !== undefined) txtMesh.material[0].color = new THREE.Color(txtColor);
            }
        }
    });

    gui.addColor( param, 'lineColor' ).onChange( function ( val ) {
        val = val.replace('#', '');    
        val = "rgb(" + parseInt(val.substring(0, 2), 16).toString() + "," + 
                       parseInt(val.substring(2, 4), 16).toString() + "," + 
                       parseInt(val.substring(4, 6), 16).toString() + ")";
        if (lineColor == val) return;
        lineColor = val;
        lines.forEach(line => line.material.color = new THREE.Color(lineColor));
    });

    var obj = { add:function(){ 
                                if (algoStatus === "stopped") {
                                    algoStatus = "running";
                                    buildHeap();
                                }
                            }
              };

    gui.add(obj, 'add').name('build heap (bottom-up)');

    var pauseObj = { pauseObj:function(){ 
        if (algoStatus === "running") {
            algoStatus = "paused";
            pauseControllerObj.name('resume execution');
            pauseControllerObj.updateDisplay();
        } else {
            algoStatus = "running";
            pauseControllerObj.name('pause  execution');
            pauseControllerObj.updateDisplay();
        }
        
    }};
    pauseControllerObj = gui.add(pauseObj, 'pauseObj'); 
    pauseControllerObj.name('pause execution');

    gui.add( param, 'algo speed', 0.01, 4).onChange( async function ( val ) {
        algoSpeed = 1/val;
    });

    var tryObj = { tryBuild:function() { tryBuild(); }
    };

    gui.add(tryObj, 'tryBuild').name('try building heap on your own!');
}

initGui();
initHeap();

// Render the scene
function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
    TWEEN.update();
}
render();