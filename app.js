/ Create a scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a large background sphere
const backgroundGeometry = new THREE.SphereGeometry(5000, 60, 40);
const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x999999, side: THREE.BackSide });
const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
scene.add(background);

// Function to generate coordinates within a torus
function randomTorusPoint(c, a) {
    const u = 2 * Math.PI * Math.random();
    const v = 2 * Math.PI * Math.random();
    const x = (c + a * Math.cos(v)) * Math.cos(u);
    const y = (c + a * Math.cos(v)) * Math.sin(u);
    const z = a * Math.sin(v);
    return new THREE.Vector3(x, y, z);
}

// Function to generate coordinates within a sphere
function randomSpherePoint(radius) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
}

// Create a texture for particles
const textureLoader = new THREE.TextureLoader();
const particleTexture = textureLoader.load('https://cdn.discordapp.com/attachments/1001038857367732236/1130478387459281047/circle.png');

function randomBlockPoint(size) {
    const x = (Math.random() - 0.5) * size;
    const y = (Math.random() - 0.5) * size;
    const z = (Math.random() - 0.5) * size;
    return new THREE.Vector3(x, y, z);
}

// Create particles
const geometry = new THREE.Geometry();
const material = new THREE.PointsMaterial({ size: 2, color: 0xaaaaaa, sizeAttenuation: true, alphaTest: 0.5, transparent: true });
let initialPositions = [];

// Generate particles and store their initial positions
for (let i = 0; i < 80000; i++) {
    const vertex = randomBlockPoint(3000); // Adjust the '1000' value to change the size of the initial block
    geometry.vertices.push(vertex);
    initialPositions.push(vertex.clone());
}
const particles = new THREE.Points(geometry, material);
scene.add(particles);

// Add lighting
const light = new THREE.PointLight(0xffffff, 1, 1000);
light.position.set(0, 0, 0);
scene.add(light);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

camera.position.z = 700;

// Create color transition
const colorStart = new THREE.Color(0x999999);
const colorEnd = new THREE.Color(0x999999);
const colorTween = new TWEEN.Tween(colorStart).to(colorEnd, 2000);

// Create camera movement
const camTweenIn = new TWEEN.Tween(camera.position).to({ z: 100 }, 10000).easing(TWEEN.Easing.Cubic.InOut);
const camTweenOut = new TWEEN.Tween(camera.position).to({ z: 700 }, 10000).easing(TWEEN.Easing.Cubic.InOut);
camTweenIn.chain(camTweenOut);
camTweenOut.chain(camTweenIn);
camTweenIn.start();

// Set a timer to change shape after 30 seconds
let changeShape = false;
setTimeout(() => {
    changeShape = true;
}, 5000);

// Create a constant for the maximum distance
const maxDistance = 1500;

// Function to render the visualization
function render(analyser, data) {
    TWEEN.update(); // Update color transition and camera movement

    // Update the data array
    analyser.getByteFrequencyData(data);

    // Calculate the average frequency
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
    }
    const average = sum / data.length;

    // Update the particles
    for (let i = 0; i < particles.geometry.vertices.length; i++) {
        const particle = particles.geometry.vertices[i];
        const factor = data.length / particles.geometry.vertices.length;
        const movementFactor = (data[Math.floor(i * factor) % data.length] + 1) * average * 0.001 + 0.001;

        // Create a wave-like motion using both sine and cosine functions
        particle.x += Math.sin(i + Date.now() * 0.0005) * movementFactor;
        particle.y += Math.sin(i + Date.now() * 0.0003) * movementFactor;
        particle.z += Math.cos(i + Date.now() * 0.0002) * movementFactor;

        // If particle is too far from the center, reset its position to its initial position
        const distance = particle.distanceTo(new THREE.Vector3(0, 0, 0));
        if (distance > maxDistance) {
            particle.copy(initialPositions[i]);
        }

        // If changeShape is true, gradually move particles towards a torus shape
        if (changeShape) {
            const targetPosition = randomTorusPoint(300, 200);
            particle.lerp(targetPosition, 0.001);
        }

        particles.material.color.setHSL((average + data[Math.floor(i * factor) % data.length]) / 510, 0.6, 0.7);
    }
    particles.geometry.verticesNeedUpdate = true;

    // Update the background sphere color
    colorEnd.setHSL((average * 360 / 255), 0.7, 0.5);
    background.material.color.copy(colorStart);
    colorTween.start();

    // Update the camera
    camera.position.x = Math.sin(Date.now() * 0.0001) * 700;
    camera.position.y = Math.cos(Date.now() * 0.0001) * 700;
    camera.lookAt(scene.position);

    // Render the scene
    renderer.render(scene, camera);

    requestAnimationFrame(() => render(analyser, data));
}

// Play button
const playButton = document.getElementById('playButton');
playButton.addEventListener('click', function() {
    // Create an audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create an audio source
    let source = audioContext.createBufferSource();

    // Fetch the audio file
    fetch('https://cors-proxy.fringe.zone/https://lovis.io/audio2.mp3')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            // Set the buffer and connect the source to the analyser
            source.buffer = audioBuffer;

            // Create an analyser
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            // Connect the source to the analyser and the analyser to the destination
            source.connect(analyser);
            analyser.connect(audioContext.destination);

            // Create a data array
            const data = new Uint8Array(analyser.frequencyBinCount);

            // Start the source and remove the play button
            source.start();
            playButton.remove();

            // Start rendering
            render(analyser, data);
        });
});
