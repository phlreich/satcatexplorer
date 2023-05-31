import * as THREE from "three";
import * as Papa from "papaparse";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const resolution = 32

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

const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( 1, 1, 2 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.zoomSpeed = 1;
controls.maxDistance = 10;
controls.minDistance = 1.2;


function orbitShapeMaker(semiMajorAxis, semiMinorAxis) {
    return new THREE.EllipseCurve(
        0,  0,            // center
        semiMajorAxis, semiMinorAxis,           // xRadius, yRadius
        0,  2 * Math.PI,  // aStartAngle, aEndAngle
        false,            // aClockwise
        0, // aRotation
    );
}

function drawOrbit(apogee, perigee, inclination) {
    let semiMajorAxis = (apogee + perigee) / 2;  
    let semiMinorAxis = Math.sqrt(apogee * perigee);  
    let orbit = orbitShapeMaker(semiMajorAxis, semiMinorAxis);
    let points = orbit.getPoints(resolution);
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material = new THREE.LineBasicMaterial({color: 0xff0000});
    let ellipse = new THREE.Line(geometry, material);
    ellipse.rotation.x = (90 + inclination) * Math.PI / 180;
    //ellipse.rotation.y = yRotation * Math.PI / 180;
    scene.add(ellipse);
}

// make x y z axis visible

const axesHelper = new THREE.AxesHelper( 5 );
scene.add( axesHelper );


fetch('data/satcat.csv')
    .then(response => response.text())
    .then(data => {
        let results = Papa.parse(data, { header: true });

        let filteredData = results.data.filter(row => row['ORBIT_TYPE'] === 'ORB'&& row['OBJECT_TYPE'] === 'PAY').slice(0, 3);

        filteredData.forEach(row => {
            let apogee = parseFloat(row['APOGEE']) * scaleFactor + earthradius;
            let perigee = parseFloat(row['PERIGEE']) * scaleFactor + earthradius;
            let inclination = parseFloat(row['INCLINATION']);
            
            drawOrbit(apogee, perigee, inclination);
        });
});

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    // rotate the earth
    earth.rotation.y += 0.0000;
	requestAnimationFrame( animate );
    let distance = camera.position.length();
    controls.rotateSpeed = distance * 0.3;
    controls.update();
	renderer.render( scene, camera );
    onWindowResize();
}

animate();