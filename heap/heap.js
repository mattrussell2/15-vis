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
import _ from 'underscore';

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

// params for tree and array node positions
const treeXStart = 0;
const treeYStart = 100;
const aryY = -100;
const maxAryWidth = frustumSize * aspect * .9; 
const textDeltaZ = 5; // shift text forward so visible
const boxZ = -100;    // z location of the boxes

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

// holds swaps from pc solving heap algo. 
var swaps = [];
var swapIdx = 0;

// Define a function to create a single node
function createNode( x, y, z, level, i, format ) {
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
    node.userData.i = i;
    node.name = i.toString() + '_' + format + '_box_idx';

    scene.add( node );
    
    return node;
}

function createTextMesh( num, x, y, z, i, format ) {
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
    textMesh.userData.i = i;
    scene.add( textMesh );

    return textMesh;
}


const setBoxColors = ( nodeIdx, color ) => {
    const treeBox = scene.getObjectByName( nodeIdx.toString() + '_tree_box_idx' ).children[ 0 ];
    const aryBox = scene.getObjectByName( nodeIdx.toString() + '_array_box_idx' ).children[ 0 ];

    treeBox.material.color.set( color );
    aryBox.material.color.set( color );
}

// given a node, toggles the box around it; assumes box is first child
const toggleBoxes = ( nodeIdx ) => {
    const treeBox = scene.getObjectByName( (nodeIdx - 1).toString() + '_tree_box_idx' ).children[ 0 ];
    const aryBox = scene.getObjectByName( nodeIdx.toString() + '_array_box_idx' ).children[ 0 ];

    treeBox.visible = !treeBox.visible;
    aryBox.visible = !aryBox.visible;
    return treeBox.visible;
}

var heap = [];
var lines = [];

function initHeap() {

    // clear objects from scene
    lines.forEach(line => scene.remove(line));
    lines = [];

    applyToNodes( scene.remove );
    applyToText ( scene.remove );
   
    // actually create the heap.
    heap = [ "\u00D8" ];
    while ( heap.length < heapSize + 1 ) {
        const r = Math.floor( Math.random() * 100 );
        if ( heap.indexOf(r) === -1 ) heap.push( r );
    }
    
    // clean this up ...

    // initialize the nodes for the tree and array
    createNode( treeXStart, treeYStart, boxZ, 0, 0, 'tree' );
    createTextMesh( heap[ 1 ], treeXStart, treeYStart, boxZ, 0, 'tree' );
    
    createNode( aryXStart, aryY, boxZ, 0xd3d3d3, -1, 'array' ) ; // null box color
    createTextMesh( heap[0], aryXStart, aryY, boxZ, 0, 'array' );
    createTextMesh( 0, aryXStart, aryY + boxDim / 2, boxZ, 0, 'arrayNums' );
   
    for ( let i = 1; i < heapSize + 1; i++ ) {
        
        if ( i < heapSize ) {
            const levelNum = Math.floor( Math.log2( i + 1 ) );
            const parentIdx = Math.floor( (i - 1) / 2 );
            const parent = scene.getObjectByName( parentIdx.toString() + '_tree_box_idx' );
            const isLeft = i % 2 !== 0;

            const treeX = parent.position.x + (isLeft ? -100 : 100) * Math.pow(0.5, levelNum - 1);
            const treeY = parent.position.y - 30;
            createNode( treeX, treeY, boxZ, levelNum, i, 'tree' );
            createTextMesh( heap[ i + 1 ], treeX, treeY, boxZ, i, 'tree' );
        }

        const levelNum = Math.floor( Math.log2( i ) );
        const aryX = aryXStart + i * aryDeltaX;
        createNode( aryX, aryY, boxZ, levelNum, i, 'array' );
        createTextMesh( heap[ i ], aryX, aryY, boxZ, i, 'array' );
        createTextMesh( i, aryX, aryY + boxDim / 2, boxZ, i, 'arrayNums' );

    }

    // lines connecting the nodes
    for (let i = 1; i < heapSize; i++) {
        const levelNum = Math.floor( Math.log2( i + 1 ) );
        
        const curr = scene.getObjectByName( i.toString() + '_tree_box_idx' );
        const parent = scene.getObjectByName( Math.floor( ( i - 1 ) / 2 ).toString() + '_tree_box_idx' );
        
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
    nodeList.forEach( nodeIdx => toggleBoxes( nodeIdx ) );
    await new Promise( ( resolve ) => setTimeout( resolve, onTime ) );
    if ( algoStatus === "paused" ) await pause();
    nodeList.forEach( nodeIdx => toggleBoxes( nodeIdx ) );
    await new Promise( ( resolve ) => setTimeout( resolve, offTime ) );
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

function sortNumbers(a, b) {
    return a > b ? 1 : b > a ? -1 : 0;
}

async function swap( childIdx, parentIdx, quiet=false, pc=true ) {
    let indices = [ childIdx, parentIdx ];
    indices.sort(sortNumbers);
    
    if ( pc ) swaps.push( indices );

    if ( !quiet ) await toggleNodes( [ childIdx, parentIdx ] );

    const numChild = heap[ childIdx ];
    const numParent = heap[ parentIdx ];

    if ( !quiet ) {
        const childTreeText = scene.getObjectByName(numChild.toString() + "_tree");
        const parentTreeText = scene.getObjectByName(numParent.toString() + "_tree");
        tweenSwap(childTreeText, parentTreeText);

        const childAryText = scene.getObjectByName(numChild.toString() + "_array");
        const parentAryText = scene.getObjectByName(numParent.toString() + "_array");
        tweenSwap(parentAryText, childAryText, 0.25);

        const tmp = childTreeText.userData.i;
        childTreeText.userData.i = parentTreeText.userData.i;
        parentTreeText.userData.i = tmp;
    }

    heap[ childIdx ] = numParent;
    heap[ parentIdx ] = numChild;                                           
}

async function reHeapDown( parentIdx, quiet=false ) {
    if ( parentIdx <= 0 ) return; // root
    const leftIdx = 2 * parentIdx;
    const rightIdx = 2 * parentIdx + 1;
    if ( leftIdx >= heapSize ) return; // no children (leaf) - assume heap always full. [TODO]
    await compare(leftIdx, parentIdx, rightIdx, quiet);
}

async function compare( currIdx, parentIdx, siblingIdx, quiet=false ) {
    const currNum = heap[ currIdx ];
    const parentNum = heap[ parentIdx ];
    const siblingNum = heap[ siblingIdx ];
    
    if ( !quiet ) {
        await toggleNodes( [ currIdx ] );
        await toggleNodes( [ siblingIdx ] );
        await toggleNodes( [ parentIdx ] );
    }
    
    if ( currNum < siblingNum && currNum < parentNum ) {
        await swap( currIdx, parentIdx, quiet );
        await reHeapDown( currIdx, quiet );
    } else if ( siblingNum < parentNum && siblingNum < parentNum ) {
        await swap( siblingIdx, parentIdx, quiet );
        await reHeapDown( siblingIdx, quiet );
    }
}

async function pause() {
    while ( algoStatus === "paused" ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function buildHeap( quiet=false ) {
    swaps = [];
    const origHeap = [...heap];
    for (let i = heapSize; i > 1; i -= 2) {
        const parentIdx = Math.floor( i / 2 );
        const siblingIdx = i % 2 === 0 ? i + 1 : i - 1;
        await compare( i, parentIdx, siblingIdx, quiet );
        if ( algoStatus === "paused" ) await pause();
        console.log(i);
    }
    if ( quiet ) heap = origHeap;
    algoStatus = "stopped";
}


var toggled = [];
var numMistakes = 0;
function makeClicky(obj) {
    obj.cursor = "pointer";
    obj.on('click', function() {
        
        let i = obj.userData.i;
        console.log(obj.userData);
        if ( obj.name.includes("tree") && !obj.name.includes("box") ) {
            i++;
            console.log("treeNode");
        }
        console.log(i);
        
        const visible = toggleBoxes( i ); 
        if ( visible ) toggled.push( i );
        else toggled = toggled.filter( j => j != i );

        if ( toggled.length == 2 ) {
            toggled.sort( sortNumbers );
            const [ i, j ] = toggled;
            
            // if a is not child of b or b not child of a, complain
            if ( i * 2 !== j && ( i * 2 ) + 1 !== j ) {
                alert("Invalid swap");
                toggled.forEach( idx => toggleBoxes( idx ) );
                toggled = [];
                numMistakes++;
            } else {
                const correct = swaps[swapIdx];
                
                if ( !_.isEqual(toggled, correct) ) {
                    alert("Incorrect swap!");
                    toggled.forEach( idx => toggleBoxes( idx ) );
                    toggled = [];
                    numMistakes++;
                } else {
                    toggled.forEach( idx => setBoxColors( idx, "green" ) );
                    swap( toggled[1], toggled[0], false, false ); 
                    toggled.forEach( idx => toggleBoxes( idx ) );
                    swapIdx++;
                    toggled = [];
                }
            }
        }
        if ( swapIdx === swaps.length ) {
            if ( numMistakes === 0 ) alert("Perfect!");
            if ( numMistakes === 1 ) alert("Nice Work! You made 1 mistake.");
            if ( numMistakes > 1 && numMistakes < 4 ) alert("Finished! You made " + numMistakes + " mistakes.");
            if ( numMistakes >= 4 ) alert("Finished! You made " + numMistakes + " mistakes. Try again!");
            heap.filter((_, i) => i > 0).forEach( (_,i) => setBoxColors( i, "red") );
        }
    });
}

async function tryBuild() {
    await buildHeap( true );

    console.log("HEAP BUILT")

    // make text objects clickable
    for ( let elem of heap ) {
        for ( let format of [ 'tree', 'array' ]) {
           const node = scene.getObjectByName( elem.toString() + '_' + format );
           if ( node === undefined ) continue;
           makeClicky(node);
        }
    }
    applyToNodes(makeClicky);

}

function applyToNodes(fn) {
    for ( let i = 1; i <= heapSize; i++ ) {
        const treeNode = scene.getObjectByName( i.toString() + '_tree_box_idx' );
        const aryNode = scene.getObjectByName( i.toString() + '_array_box_idx' );
        if ( treeNode === undefined || aryNode === undefined ) continue;
        fn( treeNode );
        fn( aryNode );
    }
}

function applyToText(fn) {
    // clear text meshes
    for ( let elem of heap ) {
        for ( let format of [ 'tree', 'array' ]) {
            fn( scene.getObjectByName( elem.toString() + '_' + format ) );
        }
    }
}

async function pausePlay(obj, fn, str) {
    console.log(algoStatus);
    if (algoStatus === "stopped") {
        algoStatus = "running";
        obj.name('pause execution');
        obj.updateDisplay();
        await fn();
        obj.name(str);
        obj.updateDisplay();
    } else if (algoStatus === "running") {
        algoStatus = "paused";
        obj.name('resume execution');
        obj.updateDisplay();
    } else {
        algoStatus = "running";
        obj.name('pause execution');
        obj.updateDisplay();
    }
}


function initGui() {

    const gui = new GUI();
    gui.name = "gui";

    const param = {
        'num levels': 4,
        'color palette': 'viridis',
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

    gui.add( param, 'color palette', Object.keys(colors), 'viridis' ).onChange( function ( val ) {
        colorFormat = val;
        levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
        applyToNodes((node) => node.material.color = new THREE.Color(node.userData.level == 0xd3d3d3 ? 0xd3d3d3 : levelColors[node.userData.level]));
    }); 

    var obj = { 
                add: () => { pausePlay(buildHeapCtrl, buildHeap, 'build heap (bottom-up)'); }, 
                tryBuild: () => { tryBuild(); },
    };

    const buildFolder = gui.addFolder('Build Heap')
    buildFolder.add(obj, 'tryBuild').name('try to build a heap on your own!');
    const buildHeapCtrl = buildFolder.add(obj, 'add').name('build heap (bottom-up)');
    buildFolder.open();
    gui.add( param, 'algo speed', 0.01, 4).onChange( function ( val ) {
        algoSpeed = 1/val;
    });
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