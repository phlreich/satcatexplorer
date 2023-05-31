import * as THREE from "three";
import * as Papa from "papaparse";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const resolution = 256;

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const earthradius = 1;
const scaleFactor = earthradius / 6371;
const geometry1 = new THREE.SphereGeometry(earthradius, resolution, resolution);
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load("/2k_custom_earth_daymap.webp");
texture.colorSpace = THREE.SRGBColorSpace; // use srgb color space
const material1 = new THREE.MeshBasicMaterial( { map: texture } );
const earth = new THREE.Mesh( geometry1, material1 );
scene.add( earth );

function orbitShapeMaker(semiMajorAxis, semiMinorAxis) {
    // scale everything
    semiMajorAxis *= scaleFactor;
    semiMinorAxis *= scaleFactor;
    return new THREE.EllipseCurve(
        Math.sqrt(semiMajorAxis**2 - semiMinorAxis**2), 0,                         // center
        semiMajorAxis, semiMinorAxis,   // xRadius, yRadius
        0,  2 * Math.PI,                // aStartAngle, aEndAngle
        false,                          // aClockwise
        0,                              // aRotation
    );
}

function orbitMaker(mean_motion, eccentricity, INCLINATION, RA_OF_ASC_NODE) {
    let mu = 398600.4418; // Earth's gravitational parameter, in km^3/s^2
    let n = mean_motion * 2 * Math.PI / (24*3600); // convert from rev/day to rad/s
    let semiMajorAxis = Math.pow(mu / (n * n), 1 / 3);
    let semiMinorAxis = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity);
    let orbit = orbitShapeMaker(semiMajorAxis, semiMinorAxis);
    let points = orbit.getPoints(resolution);
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material = new THREE.LineBasicMaterial({color: 0xff0000});
    let ellipse = new THREE.Line(geometry, material);
    ellipse.rotation.x = THREE.MathUtils.degToRad(90);
    ellipse.rotation.z = THREE.MathUtils.degToRad(RA_OF_ASC_NODE);
    ellipse.rotation.y = THREE.MathUtils.degToRad(INCLINATION);
    return ellipse;
}

let k = 27;

fetch('data/satcat.csv')
    .then(response => response.text())
    .then(data => {
        let results = Papa.parse(data, { header: true });

        let filteredData = results.data.filter(row => 
            row['ORBIT_TYPE'] === 'ORB'&&
            row['OBJECT_TYPE'] === 'PAY' &&
            row['ORBIT_CENTER'] === 'EA').slice(k, k+1);

        filteredData.forEach(row => {
            fetch(`https://celestrak.com/NORAD/elements/gp.php?CATNR=${row['NORAD_CAT_ID']}&FORMAT=CSV`)
                .then(response => response.text())
                .then(data => {
                    let results = Papa.parse(data, { header: true });
                    console.log(results.data[0]);
                    let mean_motion = parseFloat(results.data[0]['MEAN_MOTION']);
                    let eccentricity = parseFloat(results.data[0]['ECCENTRICITY']);
                    let INCLINATION = parseFloat(results.data[0]['INCLINATION']);
                    let RA_OF_ASC_NODE = parseFloat(results.data[0]['RA_OF_ASC_NODE']);
                    let orbit = orbitMaker(mean_motion, eccentricity, INCLINATION, RA_OF_ASC_NODE);
                    scene.add(orbit);
                });
        });
});

// make x y z axis visible

const axesHelper = new THREE.AxesHelper( 5 );
scene.add( axesHelper );

const controls = new OrbitControls( camera, renderer.domElement );
camera.position.set( 2, 3, 2 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.zoomSpeed = 1;
controls.maxDistance = 100;
controls.minDistance = 1.2;

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
    // console.log(camera.position);
}

console.log(scene.children);
animate();