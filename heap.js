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

const green = 0xa1e57b;
const red = 0xfe6d7e;
const white = 0xf1fffc;
const yellow = 0xffed71;
const grey = 0x8a9798;
const blue = 0x7bd5f1;
const orange = 0xffb170;
const darkGrey = 0x273135;
const purple = 0xbaa0f8;

const font = new FontLoader().parse( fontData );
const frustumSize = 250;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, 
                                             frustumSize * aspect / 2, 
                                             frustumSize / 2, 
                                             frustumSize / - 2, 1, 1000 );
camera.position.z = 50;
const scene = new THREE.Scene();
scene.background = new THREE.Color( darkGrey );

const light = new THREE.AmbientLight( white );
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

const textDeltaZ = 5; // shift text forward so visible
const boxZ = -100;    // z location of the boxes

// modifable params - levels, number of elements, and colors / level in the heap, boxDim - size of x,y,z for box..
var numLevels = 4;
var heapSize = Math.pow(2, numLevels) - 1;
var nodeColor = blue;
var lineColor = blue; // red0xff6188;
var txtColor = darkGrey;


var boxDim = 16; // The default width of a box
var space = boxDim * 0.05; // The space between boxes
var maxAryWidth = heapSize * (boxDim + space);
var availableWidth = frustumSize * aspect * 0.9;
if (maxAryWidth > availableWidth) {
    boxDim = availableWidth / heapSize;
    space = boxDim * 0.05;
    maxAryWidth = heapSize * (boxDim + space);
}
var aryDeltaX = boxDim + space;
var aryXStart = -maxAryWidth / 2;

var textSize = boxDim / 2;
var textHeight = textSize - 1; 
var algoSpeed = 1;
var algoStatus = 'stopped';
var pauseControllerObj;

var swaps = [];
var swapIdx = 0;

function createNode( x, y, z, level, i, format ) {
    const geometry = format == "array" ? new THREE.BoxGeometry(boxDim, boxDim, 1) : 
                                         new THREE.SphereGeometry( boxDim / 2, 32, 32);
    const material = new THREE.MeshStandardMaterial({   
                                                        color: nodeColor, //level == 0xd3d3d3 ? level : nodeColor, 
                                                        opacity: 1, 
                                                        transparent: false,
                                                        polygonOffset: true,
                                                        polygonOffsetFactor: 1, // >0 pushes polygon further away
                                                        polygonOffsetUnits: 1, 
                                                    });

    const node = new THREE.Mesh( geometry, material );
    node.position.set(x, y, z);
    
    if ( format === "array" ) {
        console.log("HERE")

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

        const lineMat = new LineMaterial( { color: 0x000000, linewidth: 0.005 } ); // not sure why so small, but works.
        const lineMesh = new Line2( lineGeo, lineMat );
        lineMesh.visible = false;
        //onsole.log(format);
        // if (format !== "array") {
        //     lineMesh.visible = true;
        // }else {
        //     lineMesh.visible = false;
        // }

        node.add( lineMesh );
    }

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
    if ( format == "arrayNums" ) {
        tsize /= 2;
        theight /= 2;
        tcolor = 0x000000;
    }

    const textGeo = new TextGeometry( nstr, {
                                                font: font,
                                                size: tsize,
                                                height: theight,
                                                curveSegments: 12,
                                                bevelEnabled: false,
                                            });
            
    textGeo.computeBoundingBox();
    const textMat = [ 
                      new THREE.MeshBasicMaterial( { color: tcolor } ), 
                      new THREE.MeshBasicMaterial( { color: lineColor } ) 
                    ];
    const textMesh = new THREE.Mesh( textGeo, textMat );
    const textCenter = textGeo.boundingBox.getCenter( new THREE.Vector3() );

    let textY = format == "arrayNums" ? y - textCenter.y*3 : y - textCenter.y;

    textMesh.position.set( x - textCenter.x, textY, z + textDeltaZ );
    textMesh.name = num.toString() + '_' + format;
    textMesh.userData.i = i;
    scene.add( textMesh );

    return textMesh;
}

async function wait(scale=1) {
    await new Promise((resolve) => setTimeout(resolve, 2000 * algoSpeed * scale));
}

async function setColor ( i, color, pause=false, scale=1 ) {
    treeNodes[ i - 1 ].material.color.set( color );
    aryNodes[ i ].material.color.set( color );
    if ( pause ) await wait(scale);
}

async function setColors( is, color, pause=false, scale=1 ) {
    console.log(is);
    is.forEach( i => setColor( i, color ) );
    if ( pause ) await wait(scale);
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
    
    // clean this up ...

    // initialize the nodes for the tree and array
    treeNodes = [ createNode( treeXStart, treeYStart, boxZ, 0, 1, 'tree' ) ];
    aryNodes  = [ createNode( aryXStart, aryY, boxZ, 0xd3d3d3, -1, 'array' ) ]; // null box color

    createTextMesh( heap[1], treeXStart, treeYStart, boxZ, 0, 'tree' );
    createTextMesh( heap[0], aryXStart, aryY, boxZ, 0, 'array' );
    createTextMesh( 0, aryXStart, aryY - boxDim / 2, boxZ, 0, 'arrayNums' );
   
    for ( let i = 1; i < heapSize + 1; i++ ) {
        
        if ( i < heapSize ) {
            const levelNum = Math.floor( Math.log2( i + 1 ) );
            const parentIndex = Math.floor( (i - 1) / 2 );
            const parent = treeNodes[ parentIndex ];
            const isLeft = i % 2 !== 0;

            const treeX = parent.position.x + (isLeft ? -100 : 100) * Math.pow(0.5, levelNum - 1);
            const treeY = parent.position.y - 30;
            const treeNode = createNode( treeX, treeY, boxZ, levelNum, i + 1, 'tree' );
            treeNodes.push( treeNode );

            createTextMesh( heap[ i + 1 ], treeX, treeY, boxZ, i, 'tree' );
        }

        const levelNum = Math.floor( Math.log2( i ) );
        const aryX = aryXStart + i * aryDeltaX;
        const aryNodeLo = createNode( aryX, aryY, boxZ, levelNum, i, 'array' );
        aryNodes.push( aryNodeLo );

        createTextMesh( heap[ i ], aryX, aryY, boxZ, i, 'array' );
        createTextMesh( i, aryX, aryY - boxDim / 2, boxZ, i, 'arrayNums' );

    }

    // lines connecting the nodes
    for (let i = 1; i < heapSize; i++) {
        const levelNum = Math.floor( Math.log2( i + 1 ) );
        
        const curr = treeNodes[ i ];
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

    if ( !quiet ) await setColors( [ childIdx, parentIdx ], red, true );

    const numChild = heap[ childIdx ];
    const numParent = heap[ parentIdx ];

    if ( !quiet ) {
        const childTreeText = scene.getObjectByName(numChild.toString() + "_tree");
        const parentTreeText = scene.getObjectByName(numParent.toString() + "_tree");

        const childAryText = scene.getObjectByName(numChild.toString() + "_array");
        const parentAryText = scene.getObjectByName(numParent.toString() + "_array");

        childTreeText.material[0].color = new THREE.Color( 0x000000 );
        parentTreeText.material[0].color = new THREE.Color( 0x000000 );
        childAryText.material[0].color = new THREE.Color( 0x000000 );
        parentAryText.material[0].color = new THREE.Color( 0x000000 );
        
        tweenSwap(childTreeText, parentTreeText);
        tweenSwap(parentAryText, childAryText, 0.25);

        setTimeout(() => {
            childTreeText.material[0].color = new THREE.Color( darkGrey );
            parentTreeText.material[0].color = new THREE.Color( darkGrey );
            childAryText.material[0].color = new THREE.Color( darkGrey );
            parentAryText.material[0].color = new THREE.Color( darkGrey );
        }, 1000)
        
    
        const tmp = childTreeText.userData.i;
        childTreeText.userData.i = parentTreeText.userData.i;
        parentTreeText.userData.i = tmp;

    }

    heap[ childIdx ] = numParent;
    heap[ parentIdx ] = numChild;       
    
    if ( !quiet && pc ) await setColor( parentIdx, green, true, .75 );
}

async function reHeapDown( parentIdx, quiet=false ) {
    if ( parentIdx <= 0 ) return; // root
    if ( !quiet ) await setColor( parentIdx, purple, true); 
    await compare(parentIdx, quiet); 
}

async function compare( parentIdx, quiet=false ) {
    const leftIdx = 2 * parentIdx;
    const rightIdx = 2 * parentIdx + 1;

    if ( leftIdx >= heapSize ) {  // no children (leaf)
        if (quiet) return;
        await setColor( parentIdx, green, true );
        return;
    }

    const parentNum = heap[ parentIdx ];
    const leftNum = heap[ leftIdx ];
    const rightNum = heap[ rightIdx ];
    
    if ( !quiet ) await setColors( [ parentIdx, leftIdx, rightIdx ], yellow, true );
    
    if ( leftNum < rightNum && leftNum < parentNum ) {
        if ( !quiet) setColor( rightIdx, green );
        await swap( leftIdx, parentIdx, quiet );
        await reHeapDown( leftIdx, quiet );
    } else if ( rightNum < parentNum ) {
        if ( !quiet) setColor( leftIdx, green );
        await swap( rightIdx, parentIdx, quiet );
        await reHeapDown( rightIdx, quiet );
    } else {
        if ( !quiet ) await setColors( [ parentIdx, leftIdx, rightIdx ], green, true );
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
    if ( !quiet ) {
        const done_node_indices = _.range(Math.floor(heapSize / 2) + 1, heapSize + 1);
        await setColors( done_node_indices, purple, true );
        await setColors( done_node_indices, green, true );
    }
    for (let i = Math.floor(heapSize / 2); i > 0; i -= 1) {
        await(reHeapDown(i, quiet));
        if ( algoStatus === "paused" ) await pause();
    }
    if ( quiet ) heap = origHeap;
    algoStatus = "stopped";
    console.log("done building");
}

function getColor( i ) {
    return treeNodes[ i - 1 ].material.color;
}

function toggleColor( i ) {
    const currColor = getColor( i ).getHex();
    const newColor = currColor === blue ? yellow : blue;
    setColor( i, newColor );
    return newColor;
}

var toggled = [];
var numMistakes = 0;
function makeClicky(obj) {
    obj.cursor = "pointer";
    obj.on('click', function() {
        let i = obj.userData.i;
        if ( obj.name.includes("tree") && !obj.name.includes("box") ) {
            i++;
        }
        
        const visible = toggleColor( i ) === yellow;
        if ( visible ) toggled.push( i );
        else toggled = toggled.filter( j => j != i );

        if ( toggled.length == 2 ) {
            toggled.sort( sortNumbers );
            const [ i, j ] = toggled;
            
            // if a is not child of b or b not child of a, complain
            if ( i * 2 !== j && ( i * 2 ) + 1 !== j ) {
                alert("Invalid swap");
                toggled.forEach( idx => toggleColor( idx ) );
                toggled = [];
                numMistakes++;
            } else {
                const correct = swaps[swapIdx];
                
                if ( !_.isEqual(toggled, correct) ) {
                    alert("Incorrect swap!");
                    toggled.forEach( idx => toggleColor( idx ) );
                    toggled = [];
                    numMistakes++;
                }else {
                    swap( toggled[1], toggled[0], false, false ); 
                    setColors( toggled, blue );
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
        }
    });
    
}

async function tryBuild() {
    await buildHeap( true );
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
        'width': 5,
        'text color': txtColor,
        'line color': lineColor,
        'node color': nodeColor,
        'algo speed': 1
    };

    gui.add( param, 'num levels', 2, 6, 1).onChange( function ( val ) {
        if (numLevels == val || algoStatus !== "stopped" ) return;
        numLevels = val;

        // heap is about to change, so remove old heap objects
        for ( let i of Array(heapSize + 1).keys()) {
            scene.remove( scene.getObjectByName( i.toString() + '_arrayNums' ) );
        }

        heapSize = Math.pow(2, numLevels) - 1;
        boxDim = 16; // The default width of a box
        space = boxDim * 0.05; // The space between boxes
        maxAryWidth = heapSize * (boxDim + space);
        availableWidth = frustumSize * aspect * 0.9;
        if (maxAryWidth > availableWidth) {
            boxDim = availableWidth / heapSize;
            space = boxDim * 0.05;
            maxAryWidth = heapSize * (boxDim + space);
        }
        aryDeltaX = boxDim + space;
        aryXStart = -maxAryWidth / 2;
        
        textSize = boxDim / 2;
        textHeight = textSize - 1; 
        
        initHeap();
    });

    const colorFolder = gui.addFolder( 'colors' );

    colorFolder.addColor( param, 'node color' ).onChange( function ( val ) {
        if (nodeColor == val) return;
        nodeColor = val;
        treeNodes.forEach(node => node.material.color = new THREE.Color(nodeColor));
        aryNodes.forEach(node => node.material.color = new THREE.Color(nodeColor));
    });

    colorFolder.addColor( param, 'text color' ).onChange( function ( val ) {
        if (txtColor == val) return;
        txtColor = val;

        for ( let elem of heap ) {
            for ( let format of [ 'tree', 'array' ]) {
                const txtMesh = scene.getObjectByName( elem.toString() + '_' + format );
                if ( txtMesh !== undefined) txtMesh.material[0].color = new THREE.Color(txtColor);
            }
        }
    });

    colorFolder.addColor( param, 'line color' ).onChange( function ( val ) {
        if (lineColor == val) return;
        lineColor = val;
        lines.forEach(line => line.material.color = new THREE.Color(lineColor));
    });

    colorFolder.close();


    
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

    var tryObj = { tryBuild: function() { tryBuild(); }
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


window.addEventListener('resize', () => {
    // Get the new width and height
    let width = window.innerWidth;
    let height = window.innerHeight;
  
    // Update the renderer size
    renderer.setSize(width, height);
  
    // Update the aspect ratio
    let aspect = width / height;
  
    // Update the camera's frustum
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
  
    // Update the camera's projection matrix
    camera.updateProjectionMatrix();
  });
