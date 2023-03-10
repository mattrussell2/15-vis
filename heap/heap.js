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
const camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, 
                                             frustumSize / 2, frustumSize / - 2, 1, 1000 );
camera.position.z = 50;
const scene = new THREE.Scene();
const light = new THREE.AmbientLight( 0xffffff);
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

// modifable params - levels, number of elements, and colors / level in the heap, boxDim - size of x,y,z for box..
var numLevels = 4;
var heapSize = Math.pow(2, numLevels) - 1;
var levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat](i / numLevels));
var boxDim = 15;

// params for tree and array node positions
const treeXStart = 0;
const treeYStart = 75;
const aryY = -100;
const aryWidth = frustumSize * aspect * .9; 
const aryDeltaX = aryWidth / heapSize;
const aryXStart = -aryWidth / 2 + aryDeltaX / 2;
const textDeltaZ = 5; // shift text forward so visible
const boxZ = 0; // z location of the boxes

// Define a function to create a single node
function createNode(x, y, z, color) {
    const geometry = new THREE.BoxGeometry(boxDim, boxDim, boxDim);
    const material = new THREE.MeshBasicMaterial({ color: color, 
                                                   opacity: 0.9, 
                                                   transparent: true,
                                                   polygonOffset: true,
                                                   polygonOffsetFactor: 1, // positive value pushes polygon further away
                                                   polygonOffsetUnits: 1 } );
    const node = new THREE.Mesh( geometry, material );
    node.position.set(x, y, z);

    // selector box for the node
    const offset = boxDim / 2;
    const zPos = boxZ + 5;
    const positions = [ -offset, offset, zPos,  // left top
                        offset, offset, zPos,   // right top
                        offset, -offset, zPos,  // right bottom
                        -offset, -offset, zPos, // left bottom
                        -offset, offset, zPos ]; 
    
    const geo = new LineGeometry();
    geo.setPositions( positions );
    geo.setColors([212, 72, 66]);

    const mat = new LineMaterial( { color: 0xd44842, linewidth: 0.005 } ); // not sure why so small, but it works.
    const line = new Line2( geo, mat );
    line.visible = false;

    node.add( line );
    scene.add( node );

    return node;
}

var treeNodes = [];
var aryNodes = [];
var heap = [];
var textMeshes = {'ary':[], 'tree':[]};

function initHeap() {

    // clear objects from scene
    treeNodes.forEach(node => scene.remove(node));
    aryNodes.forEach(node => scene.remove(node));
    textMeshes['ary'].forEach(text => scene.remove(text));
    textMeshes['tree'].forEach(text => scene.remove(text));
    textMeshes['ary'] = [];
    textMeshes['tree'] = [];


    // initialize the nodes for the tree and array
    treeNodes = [ createNode(treeXStart, treeYStart, boxZ, levelColors[0]) ];
    aryNodes = [ createNode(aryXStart, aryY, boxZ, levelColors[0]) ];

    console.log(treeXStart, treeYStart, aryY, aryWidth, aryDeltaX, aryXStart, textDeltaZ, boxZ);
    
    // actually create the heap.
    heap = [];
    while(heap.length < heapSize){
        const r = Math.floor(Math.random() * 100); // make all numbers be two digits. 
        if (heap.indexOf(r) === -1) heap.push(r);
    }

    // create the text meshes for the numbers themselves. 
    heap.forEach(num => {
        Object.keys(textMeshes).forEach(key => {
            let nstr = num.toString();
            if (num < 10) {
                nstr = '0' + nstr;
            }
            const geometry = new TextGeometry( nstr, {
                                                        font: font,
                                                        size: 8,
                                                        height: 5,
                                                        curveSegments: 12,
                                                        bevelEnabled: true,
                                                        bevelThickness: 1,
                                                        bevelSize: 0.5,
                                                        bevelOffset: 0,
                                                        bevelSegments: 1
                                                    } );
                                                        
            geometry.computeBoundingBox();
            const material = [
                                new THREE.MeshBasicMaterial( { color: 0xdddddd }),
                                new THREE.MeshBasicMaterial( { color: 0x000000 })
                            ];
            const textMesh = new THREE.Mesh( geometry, material );
            scene.add( textMesh );
            textMeshes[key].push( textMesh );
        })
    });

    // initialize the root text elements. 
    const bx = (textMeshes['tree'][0].geometry.boundingBox.max.x - textMeshes['tree'][0].geometry.boundingBox.min.x) / 2;
    const by = (textMeshes['tree'][0].geometry.boundingBox.max.y - textMeshes['tree'][0].geometry.boundingBox.min.y) / 2;
    textMeshes['tree'][0].position.set(treeXStart - bx, treeYStart - by, boxZ + textDeltaZ); 
    textMeshes['ary'][0].position.set(aryXStart - bx, aryY - by, boxZ + textDeltaZ);

    for (let i = 1; i < heapSize; i++) {
        const levelNum = Math.floor(Math.log2(i+1));
        
        const parentIndex = Math.floor((i - 1) / 2);
        const parent = treeNodes[parentIndex];
        const isLeft = i % 2 !== 0;

        const treeX = parent.position.x + (isLeft ? -100 : 100) * Math.pow(0.5, levelNum - 1);
        const treeY = parent.position.y - 30;
        const treeNode = createNode(treeX, treeY, boxZ, levelColors[levelNum]);
        treeNodes.push(treeNode);

        const aryX = aryXStart + i * aryDeltaX;
        const aryNodeLo = createNode(aryX, aryY, boxZ, levelColors[levelNum]);
        aryNodes.push(aryNodeLo);

        const bx = (textMeshes['tree'][i].geometry.boundingBox.max.x - textMeshes['tree'][i].geometry.boundingBox.min.x) / 2;
        const by = (textMeshes['tree'][i].geometry.boundingBox.max.y - textMeshes['tree'][i].geometry.boundingBox.min.y) / 2;

        textMeshes['tree'][i].position.set(treeX - bx, treeY - by, boxZ + 10);
        textMeshes['ary'][i].position.set(aryX - bx, aryY - by, boxZ + 10);
    }
    console.log(aryNodes);
}

function initGui() {

    const gui = new GUI();

    const param = {
        'num levels': 4,
        'color scheme': 'viridis',
        'width': 5,
        'alphaToCoverage': true,
        'dashed': false,
        'dash scale': 1,
        'dash / gap': 1
    };

    gui.add( param, 'num levels', 2, 5, 1).onChange( function ( val ) { 
        numLevels = val;
        heapSize = Math.pow(2, numLevels) - 1;
        levelColors = Array(numLevels).fill(0).map((_, i) => colors[colorFormat](i / numLevels));
        initHeap();
    });


    // gui.add( param, 'line type', { 'LineGeometry': 0, 'gl.LINE': 1 } ).onChange( function ( val ) {

    //     switch ( val ) {

    //         case 0:
    //             line.visible = true;

    //             line1.visible = false;

    //             break;

    //         case 1:
    //             line.visible = false;

    //             line1.visible = true;

    //             break;

    //     }

    // } );

    // gui.add( param, 'world units' ).onChange( function ( val ) {

    //     matLine.worldUnits = val;
    //     matLine.needsUpdate = true;

    // } );

    // gui.add( param, 'width', 1, 10 ).onChange( function ( val ) {

    //     matLine.linewidth = val;

    // } );

    // gui.add( param, 'alphaToCoverage' ).onChange( function ( val ) {

    //     matLine.alphaToCoverage = val;

    // } );

    // gui.add( param, 'dashed' ).onChange( function ( val ) {

    //     matLine.dashed = val;
    //     line1.material = val ? matLineDashed : matLineBasic;

    // } );

    // gui.add( param, 'dash scale', 0.5, 2, 0.1 ).onChange( function ( val ) {

    //     matLine.dashScale = val;
    //     matLineDashed.scale = val;

    // } );

    // gui.add( param, 'dash / gap', { '2 : 1': 0, '1 : 1': 1, '1 : 2': 2 } ).onChange( function ( val ) {

    //     switch ( val ) {

    //         case 0:
    //             matLine.dashSize = 2;
    //             matLine.gapSize = 1;

    //             matLineDashed.dashSize = 2;
    //             matLineDashed.gapSize = 1;

    //             break;

    //         case 1:
    //             matLine.dashSize = 1;
    //             matLine.gapSize = 1;

    //             matLineDashed.dashSize = 1;
    //             matLineDashed.gapSize = 1;

    //             break;

    //         case 2:
    //             matLine.dashSize = 1;
    //             matLine.gapSize = 2;

    //             matLineDashed.dashSize = 1;
    //             matLineDashed.gapSize = 2;

    //             break;

    //     }

    // } );

}

initGui();
initHeap();

// Render the scene
function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}
render();
