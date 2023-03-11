import * as THREE from 'three';
import fontData from 'three/fonts/droid_sans_mono_regular.typeface.json' assert { type: "json" };
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const font = new FontLoader().parse( fontData );
const frustumSize = 250;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, 
                                             frustumSize * aspect / 2, 
                                             frustumSize / 2, 
                                             frustumSize / - 2, 1, 1000 );
camera.position.z = 50;
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xf0f0f0 );

const light = new THREE.AmbientLight( 0xffffff );
scene.add( light );

// Set up the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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
const aryWidth = frustumSize * aspect * .9; 
const textDeltaZ = 5; // shift text forward so visible
const boxZ = 0;       // z location of the boxes

// modifable params - levels, number of elements, and colors / level in the heap, boxDim - size of x,y,z for box..
var numLevels = 4;
var heapSize = Math.pow(2, numLevels) - 1;
var levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
var boxDim = 16;
var txtLineColor = 0xffffff;
var aryDeltaX = aryWidth / ( heapSize + 1 );
var aryXStart = -aryWidth / 2 + aryDeltaX / 2;
var textSize = 8;
var textHeight = 5; 
var algoSpeed = 0.5;

// Define a function to create a single node
function createNode(num, x, y, z, color) {
    const geometry = new THREE.BoxGeometry(boxDim, boxDim, boxDim);
    const material = new THREE.MeshStandardMaterial({   
                                                        color: color, 
                                                        opacity: 1, 
                                                        transparent: false,
                                                        polygonOffset: true,
                                                        polygonOffsetFactor: 1, // positive value pushes polygon further away
                                                        polygonOffsetUnits: 1, 
                                                        roughness: 0.2, metalness: 0.3,
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

    // make text
    let nstr = num.toString();
    if (num < 10) nstr = '0' + nstr; // pad with 0

    const textGeo = new TextGeometry( nstr, {
                                                font: font,
                                                size: textSize,
                                                height: textHeight,
                                                curveSegments: 12,
                                                bevelEnabled: false
                                            });
                                                
    textGeo.computeBoundingBox();
    const textMat = new THREE.MeshBasicMaterial( { color: txtLineColor } );
    const textMesh = new THREE.Mesh( textGeo, textMat );
    const textCenter = textGeo.boundingBox.getCenter(new THREE.Vector3());
    textMesh.position.set( -textCenter.x, -textCenter.y, z + textDeltaZ );

    node.add( textMesh );

    scene.add( node );
    return node;
}

// given a node, toggles the box around it; assumes box is first child
const toggleBox = ( node ) => node.children[0].visible = !node.children[0].visible;

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

    // actually create the heap.
    heap = [ "\u00D8" ];
    while ( heap.length < heapSize + 1 ) {
        const r = Math.floor( Math.random() * 100 );
        if ( heap.indexOf(r) === -1 ) heap.push(r);
    }
    
    // initialize the nodes for the tree and array
    treeNodes = [ createNode( heap[1], treeXStart, treeYStart, boxZ, levelColors[0], false ) ];
    aryNodes  = [ createNode( heap[0], aryXStart, aryY, boxZ, 0xd3d3d3, true ) ]; // null box color

    for (let i = 1; i < heapSize + 1; i++) {
        
        if (i < heapSize) {
            const levelNum = Math.floor( Math.log2( i + 1 ) );
            const parentIndex = Math.floor( (i - 1) / 2 );
            const parent = treeNodes[ parentIndex ];
            const isLeft = i % 2 !== 0;

            const treeX = parent.position.x + (isLeft ? -100 : 100) * Math.pow(0.5, levelNum - 1);
            const treeY = parent.position.y - 30;
            const treeNode = createNode(heap[i + 1], treeX, treeY, boxZ, levelColors[levelNum], false);
            treeNodes.push(treeNode);
        }

        const levelNum = Math.floor( Math.log2( i ) );
        const aryX = aryXStart + i * aryDeltaX;
        const aryNodeLo = createNode(heap[i], aryX, aryY, boxZ, levelColors[levelNum], true);
        aryNodes.push(aryNodeLo);

    }

    for (let i = 1; i < heapSize; i++) {
        const levelNum = Math.floor( Math.log2( i + 1 ) );
        
        const curr = treeNodes[i];
        const parent = treeNodes[ Math.floor( ( i - 1 ) / 2 ) ];
        
        const geo = new LineGeometry();
        geo.setPositions( [ ...curr.position.toArray(), ...parent.position.toArray() ] );

        // sizing is off b/c of angles on lines; this fixes the problem. 
        const mat = new LineMaterial( { 
                                        color: txtLineColor,
                                        linewidth: 0.002 * Math.pow( 0.66, levelNum - 1 )
                                       } ); // not sure why so small, but it works.
        const line = new Line2( geo, mat );
        
        scene.add( line );
        lines.push( line )
    }
    
}

const LESS = '\u003C';
const GREATER = '\u003E';
const EQUAL = '\u003D\u003D';
const LE = '\u2264';
const GE = '\u2265';
const HUH = '\u003F';

var battleBox;
function initBattleBox() {
    scene.remove(battleBox);

    const battleBoxYSpace = ( aryY - treeNodes[treeNodes.length - 1].position.y ) + boxDim * 3;
    const battleBoxY = (treeNodes[treeNodes.length - 1].position.y + aryY ) / 2;
    const battleBoxGeo = new THREE.BoxGeometry( 100, battleBoxYSpace, 1 );
    const battleBoxMat = new THREE.MeshStandardMaterial( { color: 0x000000, roughness: 0.2, metalness: 0.3 } );
    const bbox = new THREE.Mesh( battleBoxGeo, battleBoxMat );
    bbox.position.set( 0, battleBoxY, boxZ + 5 );

    const bboxNode1 = createNode( 0, -33, battleBoxY, boxZ, 0xd3d3d3 );
    const bboxNode2 = createNode( HUH, 0, battleBoxY, boxZ, 0xd3d3d3 );
    const bboxNode3 = createNode( 0, 33, battleBoxY, boxZ, 0xd3d3d3 );
    
    battleBox = new THREE.Group();
    battleBox.add(bbox);
    battleBox.add(bboxNode1);
    battleBox.add(bboxNode2);
    battleBox.add(bboxNode3);
    
    scene.add(battleBox);
}

async function toggleNodes(nodeList, onTime=5000*algoSpeed, offTime=500*algoSpeed) {
    nodeList.forEach(node => toggleBox(node));
    await new Promise((resolve) => setTimeout(resolve, onTime));
    nodeList.forEach(node => toggleBox(node));
    
    await new Promise((resolve) => setTimeout(resolve, offTime));
}

async function compare(nodes) {
    scene.remove(battleBox.children[0]);
    
    await toggleNodes(nodes[0]);

    await toggleNodes(currNodes);
}

async function buildHeap() {
    for (let i = heapSize - 1; i > 0; i -= 2) {
        let curr = treeNodes[i];
        let parent = treeNodes[ Math.floor( ( i - 1 ) / 2 ) ];
        let sibling = i % 2 === 0 ? treeNodes[i - 1] : treeNodes[i + 1];

        const currNodes = [ curr, parent, sibling ];
        await compare(currNodes); 
        
    }
        
}


function initGui() {

    const gui = new GUI();

    const param = {
        'num levels': 4,
        'palette': 'viridis',
        'width': 5,
        'textLineColor': "#ffffff",
        'algo speed': 0.5
    };

    gui.add( param, 'num levels', 2, 6, 1).onChange( function ( val ) {
        if (numLevels == val) return;
        numLevels = val;
        heapSize = Math.pow(2, numLevels) - 1;
        levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
        aryDeltaX = aryWidth / ( heapSize + 1 );
        aryXStart = -aryWidth / 2 + aryDeltaX / 2;
        
        while (aryDeltaX > boxDim * 2 && val >= 4) {
            boxDim += 5;
            textSize += 3;
            textHeight += 0.1;
        }
        
        while (aryDeltaX < boxDim) {
            boxDim -= 5;
            textSize -= 3;
            textHeight -= 0.1;
        }
        initHeap();
        initBattleBox();
    });

    gui.add( param, 'palette', Object.keys(colors), 'viridis' ).onChange( function ( val ) {
        colorFormat = val;
        levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat]((i + 1) / numLevels));
        initHeap();
        initBattleBox();
    }); 

    gui.addColor( param, 'textLineColor' ).onChange( function ( val ) {
        val = val.replace('#', '');    
        val = "rgb(" + parseInt(val.substring(0, 2), 16).toString() + "," + 
                       parseInt(val.substring(2, 4), 16).toString() + "," + 
                       parseInt(val.substring(4, 6), 16).toString() + ")";
        if (txtLineColor == val) return;
        txtLineColor = val;
        initHeap();
        initBattleBox();
    });

    var obj = { add:function(){ buildHeap() }};
    gui.add(obj, 'add').name('build heap (bottom-up)');

    gui.add( param, 'algo speed', 0.01, 1).onChange( async function ( val ) {
        algoSpeed = 100 - val;
    });
}



initGui();
initHeap();
initBattleBox();

// Render the scene
function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}
render();
