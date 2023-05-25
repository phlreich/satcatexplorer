import * as THREE from "three";
import * as d3 from "d3";
import * as Papa from "papaparse";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const resolution = 512

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const earthradius = 1;
const scaleFactor = earthradius / 6371;
const geometry1 = new THREE.SphereGeometry(earthradius, resolution, resolution);
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load("/8081_earthmap10k.webp");
texture.colorSpace = THREE.SRGBColorSpace; // use srgb color space
const material1 = new THREE.MeshBasicMaterial( { map: texture } );
const earth = new THREE.Mesh( geometry1, material1 );
scene.add( earth );


let apogee = 3832 * scaleFactor + earthradius;
let perigee = 649 * scaleFactor + earthradius;

let semiMajorAxis = (apogee + perigee) / 2;  
let semiMinorAxis = Math.sqrt(apogee * perigee);  
let inclination = 34.24;  // In degrees

let orbitShape = new THREE.EllipseCurve(
    0,  0,            // ax, aY
    semiMajorAxis, semiMinorAxis,           // xRadius, yRadius
    0,  2 * Math.PI,  // aStartAngle, aEndAngle
    false,            // aClockwise
    0                 // aRotation
);

let points = orbitShape.getPoints(resolution);
let geometry = new THREE.BufferGeometry().setFromPoints(points);
let material = new THREE.LineBasicMaterial({color: 0xff0000});
let ellipse = new THREE.Line(geometry, material);
ellipse.rotation.x = THREE.MathUtils.degToRad(90);  // rotation to make it 3D
ellipse.rotation.y = THREE.MathUtils.degToRad(inclination); // apply inclination
scene.add(ellipse);

const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( 1, 1, 2 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.zoomSpeed = 1;
controls.maxDistance = 10;
controls.minDistance = 1.2;


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    // rotate the earth
    earth.rotation.y += 0.0002;
	requestAnimationFrame( animate );
    let distance = camera.position.length();
    controls.rotateSpeed = distance * 0.3;
    controls.update();
	renderer.render( scene, camera );
    onWindowResize();
}

animate();