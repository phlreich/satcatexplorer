import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const geometry = new THREE.SphereGeometry(1, 256, 256);
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load("/8081_earthmap10k.webp");
// use srgb color space
texture.colorSpace = THREE.SRGBColorSpace;
const material = new THREE.MeshBasicMaterial( { map: texture } );
const earth = new THREE.Mesh( geometry, material );
scene.add( earth );

const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( 1, 1, 2 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.zoomSpeed = 1;
controls.maxDistance = 8;
controls.minDistance = 1.2;

/* const light = new THREE.PointLight( 0xffffff, 1, 100 );
light.position.set( 1, 1, 2 );
scene.add( light );

// Add white dot
const dotGeometry = new THREE.SphereGeometry(0.005, 32, 32); // Small sphere
const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White material
const dot = new THREE.Mesh(dotGeometry, dotMaterial);

// Position it 550km above the equator
dot.position.set(1 + 0.086, 0, 0); // The Earth's radius is 1, so add 0.086 to place the dot at the correct altitude
scene.add(dot);

// Variables for orbiting
const orbitRadius = 1 + 0.086; // Radius of the orbit is the Earth's radius plus the altitude of the dot
const orbitSpeed = 0.012; // Orbit speed in units per second */


function animate() {
	requestAnimationFrame( animate );
    let distance = camera.position.length();
    controls.rotateSpeed = distance * 0.3;
    controls.update();

/*     // Update dot position
    let elapsedTime = clock.getElapsedTime(); // Get the elapsed time
    let angle = elapsedTime * orbitSpeed; // Calculate the new angle
    dot.position.set(orbitRadius * Math.cos(angle), 0, orbitRadius * Math.sin(angle)); // Update the dot's position */

	renderer.render( scene, camera );
}
animate();