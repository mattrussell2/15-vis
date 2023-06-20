import * as THREE       from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader }   from 'three/addons/loaders/FontLoader.js';
import { TTFLoader }    from 'three/addons/loaders/TTFLoader.js'; 
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2 }        from 'three/addons/lines/Line2.js';
import { GUI }          from 'three/addons/libs/lil-gui.module.min.js';
import { Interaction }  from './three.interaction.js/src/index.js';
import { TWEEN }        from 'tween';
import _                from 'underscore';

// 'min' or 'max'
var HEAP_TYPE   = "max";
var BUILD_STYLE = "bottom-up";
var WHO_BUILDS  = "pc";
var HEAP_BUILT  = false;
var CLICKY      = false;
var CLICK_TYPE  = "build";
var HEAPSORTING = false;

// colors!
const GREEN    = 0xa1e57b;
const RED      = 0xfe6d7e;
const WHITE    = 0xf1fffc;
const YELLOW   = 0xffed71;
const GREY     = 0x8a9798;
const BLUE     = 0x7bd5f1;
const ORANGE   = 0xffb170;
const DARKGREY = 0x273135;
const PURPLE   = 0xbaa0f8;
const BLACK    = 0x000000;

// box positioning constants
const TREE_ROOT_X = 0;
const TREE_ROOT_Y = 100;
const ARRY_Y_POSI = -100;
const TXT_DELTA_Z = 5;       // shift text forward so visible
const BOX_Z       = -100;    // z location of the boxes
const DEF_BOX_DIM = 16;

// camera params
const FRUSTUM_SIZE = 250;
var   ASPECT_RATIO = window.innerWidth / window.innerHeight;

// array can take up 90% of the screen max
var MAX_ARRY_WIDTH = FRUSTUM_SIZE * ASPECT_RATIO * 0.9;

// load the font. 
const ttf        = await new TTFLoader().loadAsync('./JetBrainsMono-Light.ttf');
const fontloader = new FontLoader();
const FONT       = fontloader.parse(ttf);

var BUILD_START_BUTTON;
var REMOVE_START_BUTTON;
var HEAPSORT_START_BUTTON;

function reset_camera() {

    renderer.setSize(window.innerWidth, window.innerHeight);
    ASPECT_RATIO      = window.innerWidth / window.innerHeight;
    camera.left       = -FRUSTUM_SIZE * ASPECT_RATIO / 2;
    camera.right      = FRUSTUM_SIZE  * ASPECT_RATIO / 2;
    camera.top        = FRUSTUM_SIZE / 2;
    camera.bottom     = -FRUSTUM_SIZE / 2;
    camera.position.z = 50;
    camera.updateProjectionMatrix();

    // max width that the arry can be 
    MAX_ARRY_WIDTH = FRUSTUM_SIZE * ASPECT_RATIO * 0.9;

}

function setup_renderer() {

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

}

// threjs objects
const camera      = new THREE.OrthographicCamera(); 
const scene       = new THREE.Scene();
const light       = new THREE.AmbientLight( WHITE );
const renderer    = new THREE.WebGLRenderer( { antialias: true } );
const interaction = new Interaction(renderer, scene, camera);

// background color and lighting
scene.background  = new THREE.Color( DARKGREY );
scene.add( light );

// prepare the camera
reset_camera();
setup_renderer();


// user-modifable params
var NUM_LEVELS  = 4;
var HEAP_SIZE   = Math.pow(2, NUM_LEVELS) - 1;
var NODE_COLOR  = BLUE;
var LINE_COLOR  = BLUE;
var TEXT_COLOR  = DARKGREY;
var ALGO_SPEED  = 1;
var ALGO_STATUS = 'stopped';

// these will change dependent on the above params
var BOX_DIM     = DEF_BOX_DIM;
var TEXT_SIZE   = BOX_DIM / 2;
var TEXT_HEIGHT = TEXT_SIZE - 1; 

// used to pause/play automated algo
var PAUSE_CONTROLLER;

// SWAPS maintains the 'correct' swaps used to build the heap
// SWAP_IDX is where the user currently is in the swap list. 
var SWAPS    = [];
var SWAP_IDX = 0;


function createNode( x, y, z, i, format ) {

    const geometry = format == "arry" ? new THREE.BoxGeometry( BOX_DIM, BOX_DIM, 1 ) : 
                                        new THREE.SphereGeometry( BOX_DIM / 2, 32, 32 );
    
    const material = new THREE.MeshStandardMaterial( {   
                                                        color: NODE_COLOR,
                                                        opacity: 1, 
                                                        transparent: false,
                                                        polygonOffset: true,
                                                        polygonOffsetFactor: 1, // >0 pushes polygon further away
                                                        polygonOffsetUnits: 1, 
                                                    } );
    const nodeMesh = new THREE.Mesh( geometry, material );

    nodeMesh.position.set(x, y, z);
    nodeMesh.userData.i = i;
    nodeMesh.name       = i.toString() + '_' + format + '_box_idx';

    scene.add( nodeMesh );

    // create the text mesh associated with the node (to start)
    if ( format == "tree" ) {
        createTextMesh( HEAP[ i ], x, y, z, i - 1, 'tree' );
    } else {
        createTextMesh( HEAP[ i ], x, y, z, i,     'arry' );
        createTextMesh( i,         x, y, z, i,     'arryNums' );
    }

    return nodeMesh;

}

function createTextMesh( num, x, y, z, i, format ) {

    let tsize   = TEXT_SIZE;
    let theight = TEXT_HEIGHT;
    let tcolor  = TEXT_COLOR;
    
    // small numbers below arry boxes
    if ( format == "arryNums" ) { 
        tsize   /= 2;
        theight /= 2;
        tcolor   = BLACK; 
        y       -= BOX_DIM / 2;
    }

    const textGeo  = new TextGeometry( (num < 10 ? '0' : '') + num.toString(),  // pad with 0 if single digit
                                        {
                                            font:   FONT,
                                            size:   tsize,
                                            height: theight//, 
                                            //curveSegments: 60 
                                        },
                                        
                                    );

    const textMat  = [ 
                      new THREE.MeshBasicMaterial( { color: tcolor } ), 
                      new THREE.MeshBasicMaterial( { color: LINE_COLOR } ) 
                     ];

    const textMesh = new THREE.Mesh( textGeo, textMat );

    // set the position of the text
    textGeo.computeBoundingBox();
    const textCenter = textGeo.boundingBox.getCenter( new THREE.Vector3() );
    const textY      = format == "arryNums" ? y - textCenter.y * 3 : y - textCenter.y;
    textMesh.position.set( x - textCenter.x, textY, z + TXT_DELTA_Z );
    
    // metadata
    textMesh.name       = num.toString() + '_' + format;
    textMesh.userData.i = i;

    scene.add( textMesh );
    return textMesh;

}

async function wait(scale=1) {

    await new Promise( ( resolve ) => setTimeout( resolve, 2000 * ALGO_SPEED * scale ) );

}

async function setColor ( i, color, slow = false, scale = 1 ) {

    if ( ALGO_STATUS === "paused" ) await pause();
    TREE_NODES[ i - 1 ].material.color.set( color );
    ARRY_NODES[ i ].material.color.set( color );
    if ( slow ) await wait( scale );

}

async function setColors( is, color, slow = false, scale = 1 ) {

    if ( ALGO_STATUS === "paused" ) await pause();
    is.forEach( i => setColor( i, color ) );
    if ( slow ) await wait( scale );

}

var HEAP       = [];
var TREE_NODES = [];
var ARRY_NODES = [];
var LINES      = [];

function initHeap() {

    BOX_DIM      = DEF_BOX_DIM;
    let spaceX   = BOX_DIM * 0.05;
    let aryWidth = HEAP_SIZE * (BOX_DIM + spaceX);

    // shrink the box size and spaceX if the arry is too big.
    if ( aryWidth > MAX_ARRY_WIDTH ) {
        BOX_DIM   = MAX_ARRY_WIDTH / HEAP_SIZE;
        spaceX    = BOX_DIM * 0.05;
        aryWidth  = HEAP_SIZE * (BOX_DIM + spaceX);
    }

    // positioning of the arry
    const ARRY_ROOT_X = -aryWidth / 2;
    const ARRY_DELT_X = BOX_DIM + spaceX;
    const UNDER_ARY_Y = ARRY_Y_POSI - BOX_DIM / 2

    // text size changes if the box dim gets smaller
    TEXT_SIZE         = BOX_DIM / 2.5;
    TEXT_HEIGHT       = TEXT_SIZE - 1; 
    
    // clear objects from scene
    TREE_NODES.forEach(node => scene.remove(node));
    ARRY_NODES.forEach(node => scene.remove(node));
    LINES.forEach(line => scene.remove(line));
    TREE_NODES = [];
    ARRY_NODES = [];
    LINES      = [];
    HEAP.forEach( ( elem, i ) => {
        for ( let format of [ 'tree', 'arry' ] ) {
            scene.remove( scene.getObjectByName( elem.toString() + '_' + format ) ); // text meshes
        }
        scene.remove( scene.getObjectByName( i.toString() + '_arryNums' ) );
    });
    
    // actually create the heap.
    HEAP = [ "\u00D8" ];
    while ( HEAP.length < HEAP_SIZE + 1 ) {
        const r = Math.floor( Math.random() * 100 );
        if ( HEAP.indexOf(r) === -1 ) HEAP.push( r );
    }
    
    // parent position required for the subsequent nodes. 
    TREE_NODES = [ createNode( TREE_ROOT_X, TREE_ROOT_Y, BOX_Z, 1, 'tree', 0 ) ];
    ARRY_NODES = [ createNode( ARRY_ROOT_X, ARRY_Y_POSI, BOX_Z, 0, 'arry', 0 ) ]; 
    
    for ( let i = 1; i < HEAP_SIZE + 1; i++ ) {
        
        if ( i < HEAP_SIZE ) {
            const levelNum = Math.floor( Math.log2( i + 1 ) );
            const parent   = TREE_NODES[ Math.floor( ( i - 1 ) / 2 ) ];
            const treeX    = parent.position.x + 100 * ( i % 2 !== 0 ? -1 : 1 ) * Math.pow( 0.5, levelNum - 1 );
            const treeY    = parent.position.y - 30;
            TREE_NODES.push( createNode( treeX, treeY, BOX_Z, i + 1, 'tree' ) );
        }

        ARRY_NODES.push( createNode( ARRY_ROOT_X + i * ARRY_DELT_X, ARRY_Y_POSI, BOX_Z, i, 'arry' ) );

    }

    // lines connecting the nodes
    for (let i = 1; i < HEAP_SIZE; i++) {
        const levelNum = Math.floor( Math.log2( i + 1 ) );
        const curr     = TREE_NODES[ i ];
        const parent   = TREE_NODES[ Math.floor( ( i - 1 ) / 2 ) ];
        
        const geo  = new LineGeometry();
        geo.setPositions( [ ...curr.position.toArray(), ...parent.position.toArray() ] );

        // sizing is off b/c of angles on lines (they get fatter as you go down the levels); this fixes the problem. 
        const mat  = new LineMaterial( { 
                                        color: LINE_COLOR,
                                        linewidth: 0.003 * Math.pow( 0.85, levelNum - 1 )
                                       } );
        const line = new Line2( geo, mat );
        
        scene.add( line );
        LINES.push( line );
    }

    iterNodes( ( node ) => { makeClicky( node ) } );
    
}

// given two points, return a point that is d along a vector perpendicular to the line formed by the original two points
// where d is half the distance between p1 and p2
const perp = (p1, p2) => {

    const d    = Math.sqrt( Math.pow( p1.x - p2.x, 2 ) + Math.pow( p1.y - p2.y, 2 ) );
    const midP = new THREE.Vector2( ( p1.x + p2.x ) / 2, ( p1.y + p2.y ) / 2);
    
    let perpVec;
    if ( p1.x > p2.x ) perpVec = new THREE.Vector2( p2.y - p1.y, p1.x - p2.x );
    else               perpVec = new THREE.Vector2( p1.y - p2.y, p2.x - p1.x );
    
    perpVec.normalize().multiplyScalar( d );
    
    return midP.add( perpVec );

}

// swaps the positions of two objects
async function tweenSwap( obj1 , obj2, scale = 1, be_patient = false ) {

    const tweenTime = 1000 * ( WHO_BUILDS === "pc" ? ALGO_SPEED : 1 );
    const bezP = perp( obj1.position, obj2.position );
    for ( const [ a, b ] of [ [ obj1, obj2 ], [ obj2, obj1 ] ] ) {
        new TWEEN.Tween( a.position ).to( {
            x: [ bezP.x * scale, b.position.x ], 
            y: [ bezP.y * scale, b.position.y ]
        }, tweenTime ).interpolation( TWEEN.Interpolation.Bezier ).start();
    }
    if ( be_patient ) { 
        await new Promise( ( resolve ) => setTimeout( resolve, tweenTime * 1.05 ) );
    }
}

function sortNumbers( a, b ) {

    return a > b ? 1 : b > a ? -1 : 0;

}

async function swap( childIdx, parenIdx, quiet = false, pc = true ) {
    
    let indices = [ childIdx, parenIdx ];
    indices.sort( sortNumbers );
    
    if ( pc ) SWAPS.push( indices );

    if ( !quiet && pc ) await setColors( [ childIdx, parenIdx ], RED, true );

    const numChild = HEAP[ childIdx ];
    const numParen = HEAP[ parenIdx ];

    if ( !quiet ) {
        const childTreeText = scene.getObjectByName(numChild.toString() + "_tree");
        const parenTreeText = scene.getObjectByName(numParen.toString() + "_tree");
        const childArryText = scene.getObjectByName(numChild.toString() + "_arry");
        const parenArryText = scene.getObjectByName(numParen.toString() + "_arry");

        childTreeText.material[0].color = new THREE.Color( BLACK );
        parenTreeText.material[0].color = new THREE.Color( BLACK );
        childArryText.material[0].color = new THREE.Color( BLACK );
        parenArryText.material[0].color = new THREE.Color( BLACK );
        
        tweenSwap(childTreeText, parenTreeText, 1, false);
        await tweenSwap(parenArryText, childArryText, 0.25, true);

        setTimeout(() => {
            childTreeText.material[0].color = new THREE.Color( DARKGREY );
            parenTreeText.material[0].color = new THREE.Color( DARKGREY );
            childArryText.material[0].color = new THREE.Color( DARKGREY );
            parenArryText.material[0].color = new THREE.Color( DARKGREY );
        }, 1000)
    
        const tmp = childTreeText.userData.i;
        childTreeText.userData.i = parenTreeText.userData.i;
        parenTreeText.userData.i = tmp;

    }

    HEAP[ childIdx ] = numParen;
    HEAP[ parenIdx ] = numChild;       

}

function cmp( a, b ) {

    return HEAP_TYPE == "min" ? a < b : a > b;

}

async function reHeapUp( nodeIdx, quiet = false ) {
    
    // root
    if ( nodeIdx <= 1 ) {
        if ( !quiet ) await setColor( nodeIdx, GREEN, true ); 
        return; 
    }

    if ( !quiet ) await setColor( nodeIdx, PURPLE, true ); 

    const parIdx = Math.floor( nodeIdx / 2 );
    if ( !quiet ) await setColors( [ nodeIdx, parIdx ], YELLOW, true );

    const nodeNum = HEAP[ nodeIdx ];
    const parNum  = HEAP[ parIdx ];

    if ( cmp( nodeNum, parNum ) ) {
        await swap( nodeIdx, parIdx, quiet );
        if ( !quiet ) await setColors( [ parIdx, nodeIdx ], GREEN );
        await reHeapUp( parIdx, quiet );
    } else {
        if ( !quiet ) await setColors( [ parIdx, nodeIdx ], GREEN, true );
    }

}

async function reHeapDown( parIdx, quiet = false ) {

    if ( parIdx <= 0 ) return; // root
    if ( !quiet ) await setColor( parIdx, PURPLE, true);

    const lftIdx = 2 * parIdx;
    const rhtIdx = 2 * parIdx + 1;

    if ( lftIdx > HEAP_SIZE ) {  // no children (leaf)
        if (quiet) return;
        await setColor( parIdx, GREEN, true );
        return;
    }

    const parNum = HEAP[ parIdx ];
    const lftNum = HEAP[ lftIdx ];
    const rhtNum = rhtIdx > HEAP_SIZE ? null : HEAP[ rhtIdx ];

    if ( rhtNum === null ) {
        if ( !quiet ) await setColors( [ parIdx, lftIdx ], YELLOW, true );
        if ( cmp( lftNum, parNum ) ) {
            await swap( lftIdx, parIdx, quiet );
            if ( !quiet ) setColor( parIdx, GREEN );
            await reHeapDown( lftIdx, quiet );
        }else {
            if ( !quiet ) await setColors( [ parIdx, lftIdx ], GREEN, true );
        }
    }else {
        if ( !quiet ) await setColors( [ parIdx, lftIdx, rhtIdx ], YELLOW, true );
        if ( cmp( lftNum, rhtNum ) && cmp( lftNum, parNum ) ) {
            if ( !quiet ) setColor( rhtIdx, GREEN );
            await swap( lftIdx, parIdx, quiet );
            if ( !quiet ) setColor( parIdx, GREEN );
            await reHeapDown( lftIdx, quiet );
        } else if ( cmp( rhtNum, parNum ) ) {
            if ( !quiet ) setColor( lftIdx, GREEN );
            await swap( rhtIdx, parIdx, quiet );
            if ( !quiet ) setColor( parIdx, GREEN ); 
            await reHeapDown( rhtIdx, quiet );
        } else {
            if ( !quiet ) await setColors( [ parIdx, lftIdx, rhtIdx ], GREEN, true );
        }
    }

}

async function pause() {

    while ( ALGO_STATUS === "paused" ) {
        await new Promise( ( resolve ) => setTimeout( resolve, 100 ) );
    }

}

async function buildHeap( quiet = false ) {
    
    SWAPS          = [];
    const origHeap = [ ...HEAP ];
    
    if ( BUILD_STYLE === "bottom-up" ) {
        if ( !quiet ) {
            const done_node_indices = _.range(Math.floor(HEAP_SIZE / 2) + 1, HEAP_SIZE + 1);
            await setColors( done_node_indices, PURPLE, true );
            await setColors( done_node_indices, GREEN, true );
        }

        for ( let i = Math.floor( HEAP_SIZE / 2 ); i > 0; i -= 1 ) {
            await( reHeapDown( i, quiet ) );
        }
    } else {
        for ( let i = 1; i < HEAP_SIZE + 1; i++ ) {
            await( reHeapUp( i, quiet ) );
        }
    }

    if ( quiet ) HEAP = origHeap;
    ALGO_STATUS = "stopped";
    console.log("done building");

    if ( !quiet ) {
        BUILD_START_BUTTON.domElement.click();  
        BUILD_START_BUTTON.name( 'build heap' );
        HEAP_BUILT = true;
    }

}

function getColor( i ) {

    return TREE_NODES[ i - 1 ].material.color;

}

function toggleColor( i ) {

    const currColor = getColor( i ).getHexString();
    let   newColor  = ( currColor === new THREE.Color(BLUE).getHexString() || 
                        currColor === new THREE.Color(GREEN).getHexString() ) ? YELLOW : BLUE;
    // hack for now
    if ( HEAPSORTING && newColor == BLUE ) newColor = GREEN;

    setColor( i, newColor );
    return newColor;

}

function timeAlert( msg, time = 1200 ) {
    
    setTimeout( () => { alert( msg ) }, time );

}

function finishAlgo() {

    unclickify();
    if      ( nMistakes === 0 ) timeAlert( "Perfect!" );
    else if ( nMistakes === 1 ) timeAlert( "Nice Work! You made 1 mistake." );
    else                        timeAlert( "You made " + nMistakes + " mistakes. Try again!" );
    if ( CLICK_TYPE === "build" ) {
        HEAP_BUILT = true;
        BUILD_START_BUTTON.domElement.click();
        BUILD_START_BUTTON.name( 'build heap' );
        setColors( [ ...Array( HEAP_SIZE ).keys() ].map( i => i + 1 ), GREEN );
    } else {
        REMOVE_START_BUTTON.domElement.click();
        REMOVE_START_BUTTON.name( 'remove element' );
    }   
    if ( HEAPSORTING ) {
        HEAPSORTING = false;
        HEAPSORT_START_BUTTON.domElement.click();
    }

    ALGO_STATUS = "stopped"; 

}

// needs refactoring. 
var toggled   = [];
var nMistakes = 0;
function makeClicky( obj ) {
    
    obj.cursor = "pointer";
    obj.on('click', function() {

        if ( !CLICKY ) return;

        let i = obj.userData.i;
        if ( obj.name.includes( "tree" ) && !obj.name.includes( "box" ) ) {
            i++;
        }
        
        const visible = toggleColor( i ) === YELLOW;

        if ( visible ) toggled.push( i );
        else toggled = toggled.filter( j => j != i );

        if ( HEAPSORTING && toggled.length == 1 && SWAP_IDX == SWAPS.length - 2 ) { 
            console.log("last swap");
            setColor( toggled[ 0 ], ORANGE);
            HEAP_SIZE--;
            toggled = [];
            finishAlgo();
            return;
        }

        if ( toggled.length == 2) {

            // sort so the same comparison made every time 
            toggled.sort( sortNumbers );
            const [ i, j ] = toggled;
            let correct    = SWAPS[SWAP_IDX];
            let colorSwap  = false;
            
            // case in heapsorting where we start with a new remove call. 
            if ( _.isEqual(correct, [ null, null ] ) ) {
                SWAP_IDX++;
                correct = SWAPS[SWAP_IDX];
                colorSwap = true;
            }

            // correct swap made
            if ( _.isEqual( toggled, correct ) ) {
                setTimeout( async () => {
                    await swap( toggled[ 0 ], toggled[ 1 ], false, false );
                    if ( CLICK_TYPE === "build" ) {
                        setColors( toggled, BLUE );
                    } else {
                        setColor( toggled[ 0 ], GREEN );
                        if ( toggled[ 0 ] == 1 && toggled[ 1 ] == HEAP_SIZE && colorSwap ) {
                            setColor( toggled[ 1 ], ORANGE );
                            HEAP_SIZE--;
                        } else {
                            setColor( toggled[ 1 ], GREEN );
                        }
                    }
                    SWAP_IDX++;
                    
                    if ( SWAP_IDX === SWAPS.length ) finishAlgo();
                    
                    toggled = []; // don't take out b/c async fn.
                }, 1500 );  
            } else {
                // bad selection
                nMistakes++;
                toggled.forEach( idx => toggleColor( idx ) );
                
                // incorrect selection
                if ( !_.isEqual(toggled, correct) ) {
                    alert("Incorrect swap!");
                } 
                // if a is not child of b and b not child of a
                else if ( i * 2 !== j && ( i * 2 ) + 1 !== j ) {
                    alert("Invalid swap"); 
                }
                toggled = [];
            }
        }
    });
}

function iterNodes( nodeFunc ) {

    for ( let elem of HEAP ) {
        for ( let format of [ 'tree', 'arry' ]) {
           const node = scene.getObjectByName( elem.toString() + '_' + format );
           if ( node === undefined ) continue;
           nodeFunc( node );
        }
    }

    TREE_NODES.forEach( node => nodeFunc( node ) );
    ARRY_NODES.forEach( node => nodeFunc( node ) );

}

function clickify() {

    iterNodes( ( node ) => {
        node.cursor = "pointer";
    } );
    CLICKY = true;
    
}

function unclickify() {

    iterNodes( ( node ) => {
        node.cursor = "auto";
    } );
    CLICKY = false;

}

async function tryBuild() {

    await buildHeap( true );
    clickify();
    CLICK_TYPE = "build";

}

async function tryRemove() {
    
    await removeElem( true );
    clickify();
    CLICK_TYPE = "remove";
    
}

// back to 'regular speed', but click the button too. 
async function speedyBuild( quiet = false) {

    const orig_algospeed = ALGO_SPEED;
    ALGO_SPEED /= 1;
    BUILD_START_BUTTON.domElement.click();
    await buildHeap( quiet );
    ALGO_SPEED = orig_algospeed;

}

async function heapSort() {

    HEAPSORTING = true;
    if ( !HEAP_BUILT ) { await buildHeap(); }
    
    const orig_size = HEAP_SIZE;
    const orig_heap = JSON.parse(JSON.stringify(HEAP));
    const all_swaps = [];
    for ( let i = HEAP_SIZE; i > 0; i-- ) {
        REMOVE_START_BUTTON.domElement.click();
        if ( WHO_BUILDS === "pc" ) await removeElem( false );
        else {
            const currSwaps = await removeElem( true );
            all_swaps.push( [ null, null ] );
            all_swaps.push( ...currSwaps );
        }
    }
    SWAPS      = all_swaps;
    SWAP_IDX   = 0;
    HEAP       = orig_heap;
    HEAP_SIZE  = orig_size;
    CLICK_TYPE = "remove";
    clickify();
    REMOVE_START_BUTTON.domElement.click();
}

async function removeElem( quiet = false ) {
    
    SWAPS    = [];
    SWAP_IDX = 0;
    const origHeap = [ ...HEAP ];

    if ( !HEAP_BUILT ) { await speedyBuild(); }

    if ( HEAP_SIZE > 0 ) {
        if ( HEAP_SIZE === 1 && !quiet ) {
            setColor( 1, ORANGE );
            HEAP_SIZE--;
        } else {
            await swap( HEAP_SIZE, 1, quiet );
            if ( !quiet ) await setColor( HEAP_SIZE, ORANGE );
            HEAP_SIZE--;
            await reHeapDown( 1, quiet );
        }
    }

    if ( !quiet || HEAP_SIZE === 0 ) {
        REMOVE_START_BUTTON.domElement.click();
        REMOVE_START_BUTTON.name( 'remove element' );
        ALGO_STATUS = "stopped";
    } else {
        if ( !HEAPSORTING ) {
            HEAP = origHeap;
            HEAP_SIZE++;
        }
    }

    return SWAPS;
}


function runFunc( pcFunc, userFunc, button  ) {
    if ( WHO_BUILDS === "pc" ) {
        if (ALGO_STATUS === "stopped") {
            ALGO_STATUS = "running";
            button.name('pause');
            button.updateDisplay();
            pcFunc();
        }else if (ALGO_STATUS === "running") {
            ALGO_STATUS = "paused";
            button.name('resume');
            button.updateDisplay();
        }else if (ALGO_STATUS === "paused") {
            ALGO_STATUS = "running";
            button.name('pause');
            button.updateDisplay();
        }
    } else {
        userFunc();
    }
}

function colorButton() {
    // Get the actual button element
    var button    = this.querySelector( '.name' );
    let dg        = "#" + new THREE.Color( DARKGREY ).getHexString();
    let currcolor = "#" + new THREE.Color( button.style.backgroundColor ).getHexString();
    if ( currcolor === dg ) {
        button.style.backgroundColor = '';  // Not selected
    } else {
        button.style.backgroundColor = dg;  // Selected
    }
}

function initGui() {

    const gui = new GUI( { width: 175 } );
    gui.name  = "gui";

    const param = {
        'num levels'  : 4,
        'width'       : 5,
        'text color'  : TEXT_COLOR,
        'line color'  : LINE_COLOR,
        'node color'  : NODE_COLOR,
        'algo speed'  : 1, 
        'heap type'   : HEAP_TYPE,
        'build style' : 'bottom-up',
        'controller'  : 'pc (auto)',
        'remove elem' : () => { runFunc( removeElem, tryRemove, REMOVE_START_BUTTON ); },
        'build'       : () => { runFunc( buildHeap, tryBuild, BUILD_START_BUTTON ); },
        'heap sort'   : () => { runFunc( heapSort, heapSort, HEAPSORT_START_BUTTON ); }
    };

    gui.add( param, 'heap type', [ 'max', 'min' ] ).onChange( function ( val ) {
        HEAP_TYPE = val;
    });

    gui.add( param, 'num levels', 2, 6, 1 ).onChange( function ( val ) {

        if (NUM_LEVELS == val || ALGO_STATUS !== "stopped" ) return;
        NUM_LEVELS = val;
        HEAP_SIZE  = Math.pow( 2, NUM_LEVELS ) - 1;
        initHeap();

    });

    const who_builds = gui.add( param, 'controller', [ 'pc (auto)', 'you! (manual)' ] )
                          .onChange( val => { val == "pc (auto)" ? WHO_BUILDS = "pc" : WHO_BUILDS = "user"; } ); 

    const algo_speed  = gui.add( param, 'algo speed', 0.01, 6 ).onChange( async v => { ALGO_SPEED = 1 / v; } );
    const build_style = gui.add( param, 'build style', [ 'bottom-up', 'top-down' ] )
                                   .onChange( val => { 
                                                       BUILD_STYLE = val; 
                                                       initHeap(); 
                                                     } 
                                            );
    BUILD_START_BUTTON = gui.add( param, 'build' ).name( 'build heap' );
    BUILD_START_BUTTON.domElement.addEventListener( 'click', colorButton ); 

    REMOVE_START_BUTTON = gui.add( param, 'remove elem' ).name( 'remove element' );
    REMOVE_START_BUTTON.domElement.addEventListener( 'click', colorButton );

    HEAPSORT_START_BUTTON = gui.add( param, 'heap sort' ).name( 'heap sort' );
    HEAPSORT_START_BUTTON.domElement.addEventListener( 'click', colorButton );
}

initGui();
initHeap();

// Render the scene
function render() {

    requestAnimationFrame( render );
    renderer.render( scene, camera );
    TWEEN.update();

}

render();

window.addEventListener('resize', () => {
    reset_camera();
});
