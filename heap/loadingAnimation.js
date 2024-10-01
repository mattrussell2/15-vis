import * as THREE from 'three';

let loadingScene, loadingCamera, loadingRenderer, loadingCube;

function initLoadingAnimation() {
    loadingScene = new THREE.Scene();
    
    // Get the loading div dimensions
    const loadingDiv = document.getElementById('loading');
    const width = loadingDiv.clientWidth;
    const height = loadingDiv.clientHeight;
    
    // Use the correct aspect ratio
    loadingCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    loadingRenderer = new THREE.WebGLRenderer({ canvas: document.getElementById('loadingCanvas'), alpha: true });
    loadingRenderer.setSize(width, height);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    loadingCube = new THREE.Mesh(geometry, material);
    loadingScene.add(loadingCube);

    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(0, 0, 10);
    loadingScene.add(light);

    // Add ambient light to better illuminate the cube
    const ambientLight = new THREE.AmbientLight(0x404040);
    loadingScene.add(ambientLight);

    loadingCamera.position.z = 5;
}

function animateLoading() {
    requestAnimationFrame(animateLoading);

    loadingCube.rotation.x += 0.01;
    loadingCube.rotation.y += 0.01;

    // Change color over time
    const time = Date.now() * 0.001;
    const r = Math.sin(time * 0.5) * 0.5 + 0.5;
    const g = Math.sin(time * 0.3) * 0.5 + 0.5;
    const b = Math.sin(time * 0.7) * 0.5 + 0.5;
    loadingCube.material.color.setRGB(r, g, b);

    loadingRenderer.render(loadingScene, loadingCamera);
}

export function showLoading() {
    if (!loadingScene) {
        initLoadingAnimation();
        animateLoading();
    }
    document.getElementById('loading').style.display = 'flex';
}

export function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Add window resize handler
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    const loadingDiv = document.getElementById('loading');
    const width = loadingDiv.clientWidth;
    const height = loadingDiv.clientHeight;

    loadingCamera.aspect = width / height;
    loadingCamera.updateProjectionMatrix();

    loadingRenderer.setSize(width, height);
}