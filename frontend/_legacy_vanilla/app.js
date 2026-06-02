/* ==========================================
   SYNTHETIX – 3D Frontend Application
   Three.js Particle Effects + API Integration
   ========================================== */

// ─── Configuration ───
const API_BASE = 'http://localhost:8000/api/v1';
let recentAnalyses = [];
let dashboardStats = { total: 0, clusters: 0, dupes: 0, avgConf: 0 };

// ─── Three.js 3D Background ───
const canvas = document.getElementById('bg-canvas');
let scene, camera, renderer, particles, geometryShapes = [];
let mouseX = 0, mouseY = 0;
let animationFrame;

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particle System
    const particleCount = 2000;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 150;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 150;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

        // Cyan to purple gradient
        const t = Math.random();
        colors[i * 3] = t * 0.0 + (1 - t) * 0.75;       // R
        colors[i * 3 + 1] = t * 0.94 + (1 - t) * 0.35;   // G
        colors[i * 3 + 2] = t * 1.0 + (1 - t) * 0.95;    // B

        sizes[i] = Math.random() * 2 + 0.5;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Floating Geometric Shapes
    createFloatingShapes();

    // Connection Lines
    createConnectionLines();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('mousemove', onMouseMove);

    animate();
}

function createFloatingShapes() {
    const shapes = [
        { geo: new THREE.IcosahedronGeometry(2, 0), pos: [-30, 20, -20] },
        { geo: new THREE.OctahedronGeometry(1.5, 0), pos: [35, -15, -30] },
        { geo: new THREE.TetrahedronGeometry(1.8, 0), pos: [-25, -25, -15] },
        { geo: new THREE.IcosahedronGeometry(1.2, 0), pos: [20, 25, -25] },
        { geo: new THREE.OctahedronGeometry(2.2, 0), pos: [-40, 0, -35] },
        { geo: new THREE.DodecahedronGeometry(1.5, 0), pos: [40, 10, -20] },
    ];

    shapes.forEach(({ geo, pos }) => {
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0x00f0ff),
            wireframe: true,
            transparent: true,
            opacity: 0.15,
        });
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(...pos);
        mesh.userData = {
            rotSpeed: { x: Math.random() * 0.005, y: Math.random() * 0.005, z: Math.random() * 0.003 },
            floatOffset: Math.random() * Math.PI * 2,
            floatSpeed: 0.3 + Math.random() * 0.5,
            floatAmount: 0.5 + Math.random() * 1,
        };
        scene.add(mesh);
        geometryShapes.push(mesh);
    });
}

function createConnectionLines() {
    const lineCount = 15;
    for (let i = 0; i < lineCount; i++) {
        const lineGeo = new THREE.BufferGeometry();
        const points = [];
        const start = new THREE.Vector3(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 50 - 20,
        );
        const end = new THREE.Vector3(
            start.x + (Math.random() - 0.5) * 40,
            start.y + (Math.random() - 0.5) * 40,
            start.z + (Math.random() - 0.5) * 20,
        );
        points.push(start, end);
        lineGeo.setFromPoints(points);

        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.04,
        });

        scene.add(new THREE.Line(lineGeo, lineMat));
    }
}

function animate() {
    animationFrame = requestAnimationFrame(animate);

    const time = Date.now() * 0.001;

    // Rotate particle field
    if (particles) {
        particles.rotation.y += 0.0003;
        particles.rotation.x += 0.0001;

        // Mouse parallax
        particles.rotation.y += (mouseX * 0.00005 - particles.rotation.y * 0.01);
        particles.rotation.x += (mouseY * 0.00003 - particles.rotation.x * 0.01);
    }

    // Animate floating shapes
    geometryShapes.forEach((mesh) => {
        const d = mesh.userData;
        mesh.rotation.x += d.rotSpeed.x;
        mesh.rotation.y += d.rotSpeed.y;
        mesh.rotation.z += d.rotSpeed.z;
        mesh.position.y += Math.sin(time * d.floatSpeed + d.floatOffset) * d.floatAmount * 0.01;
    });

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
    mouseX = e.clientX - window.innerWidth / 2;
    mouseY = e.clientY - window.innerHeight / 2;
}

// ─── Navigation ───
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const page = document.getElementById(pageId);
    const link = document.querySelector(`[data-page="${pageId}"]`);

    if (page) page.classList.add('active');
    if (link) link.classList.add('active');

    // Load dashboard data when navigating to it
    if (pageId === 'dashboard') loadDashboard();

    window.scrollTo(0, 0);
}

// Nav link click handlers
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
    });
});

// ─── Dashboard ───
async function loadDashboard() {
    try {
        const health = await fetch(`${API_BASE}/health`).then(r => r.json());
        animateNumber('stat-total', health.total_defects || 0);
        animateNumber('stat-clusters', health.total_clusters || 0);
        dashboardStats.total = health.total_defects;
        dashboardStats.clusters = health.total_clusters;
    } catch (e) {
        console.warn('Dashboard: API not available', e);
    }

    // Update recent analyses from memory
    updateRecentList();

    // Draw cluster visualization
    drawClusterViz();
}

function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    const duration = 800;
    const start = Date.now();

    function update() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(current + (target - current) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    update();
}

function updateRecentList() {
    const list = document.getElementById('recent-list');
    if (!list) return;

    if (recentAnalyses.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>No analyses yet. Submit a defect to get started.</p>
            </div>`;
        return;
    }

    list.innerHTML = recentAnalyses.slice(0, 8).map(a => {
        const decClass = a.decision === 'duplicate' ? 'decision-duplicate' :
            a.decision === 'possible_duplicate' ? 'decision-possible' : 'decision-new';
        const decText = a.decision === 'possible_duplicate' ? 'POSSIBLE' :
            a.decision.toUpperCase();
        return `
            <div class="recent-item">
                <span class="recent-decision ${decClass}">${decText}</span>
                <span class="recent-title">${escapeHtml(a.title)}</span>
                <span class="recent-score">${(a.confidence * 100).toFixed(1)}%</span>
            </div>`;
    }).join('');
}

// ─── Cluster Visualization (2D Canvas) ───
function drawClusterViz() {
    const canvas = document.getElementById('cluster-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 56;
    canvas.height = 300;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate cluster nodes
    const clusterColors = ['#00f0ff', '#bf5af2', '#ff375f', '#30d158', '#ffd60a', '#ff9500', '#5ac8fa'];
    const nodeCount = Math.max(dashboardStats.total, 20);
    const clusterCount = Math.max(dashboardStats.clusters, 4);
    const nodes = [];

    // Generate cluster centers
    const centers = [];
    for (let c = 0; c < clusterCount; c++) {
        centers.push({
            x: 60 + Math.random() * (canvas.width - 120),
            y: 40 + Math.random() * (canvas.height - 80),
            color: clusterColors[c % clusterColors.length],
        });
    }

    // Generate nodes around centers
    for (let i = 0; i < nodeCount; i++) {
        const cluster = Math.floor(Math.random() * clusterCount);
        const center = centers[cluster];
        nodes.push({
            x: center.x + (Math.random() - 0.5) * 80,
            y: center.y + (Math.random() - 0.5) * 60,
            r: 2 + Math.random() * 3,
            color: center.color,
            cluster,
        });
    }

    // Draw connections within clusters
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[i].cluster !== nodes[j].cluster) continue;
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 50) {
                ctx.beginPath();
                ctx.moveTo(nodes[i].x, nodes[i].y);
                ctx.lineTo(nodes[j].x, nodes[j].y);
                ctx.strokeStyle = nodes[i].color.replace(')', ', 0.08)').replace('rgb', 'rgba').replace('#', '');
                // Use hex alpha
                ctx.globalAlpha = 0.08;
                ctx.strokeStyle = nodes[i].color;
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }
    }

    // Draw nodes
    nodes.forEach(node => {
        // Glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.08;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Draw cluster labels
    centers.forEach((c, i) => {
        ctx.font = '600 10px Inter';
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.6;
        ctx.fillText(`Cluster ${i}`, c.x - 20, c.y - 40);
        ctx.globalAlpha = 1;
    });
}

// ─── Dataset Ingestion ───
const fileInput = document.getElementById('ingest-file');
const ingestBtn = document.getElementById('ingest-btn');
const filenameSpan = document.getElementById('ingest-filename');

if (fileInput) {
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            filenameSpan.textContent = fileInput.files[0].name;
            ingestBtn.disabled = false;
        } else {
            filenameSpan.textContent = 'No file selected';
            ingestBtn.disabled = true;
        }
    });
}

async function ingestDataset() {
    const file = fileInput.files[0];
    if (!file) return;

    const progress = document.getElementById('ingest-progress');
    const fill = document.getElementById('ingest-progress-fill');
    const text = document.getElementById('ingest-progress-text');
    const result = document.getElementById('ingest-result');

    progress.classList.remove('hidden');
    result.classList.add('hidden');
    ingestBtn.disabled = true;

    // Animate progress
    fill.style.width = '20%';
    text.textContent = 'Uploading dataset...';

    try {
        const formData = new FormData();
        formData.append('file', file);

        fill.style.width = '50%';
        text.textContent = 'Processing embeddings...';

        const response = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            body: formData,
        });

        fill.style.width = '90%';
        text.textContent = 'Running clustering...';

        if (!response.ok) {
            throw new Error(`Ingestion failed: ${response.status}`);
        }

        const data = await response.json();

        fill.style.width = '100%';
        text.textContent = 'Complete!';

        result.classList.remove('hidden', 'error');
        result.innerHTML = `
            ✅ <strong>${data.message}</strong><br>
            Ingested: ${data.total_ingested} | Skipped: ${data.total_skipped} | Clusters: ${data.clusters_formed}
        `;

        // Refresh dashboard stats
        loadDashboard();

    } catch (e) {
        fill.style.width = '100%';
        fill.style.background = 'var(--pink)';
        text.textContent = 'Error!';

        result.classList.remove('hidden');
        result.classList.add('error');
        result.textContent = `❌ ${e.message}`;
    }

    ingestBtn.disabled = false;
}

// ─── Defect Analyzer ───
async function analyzeDefect(event) {
    event.preventDefault();

    const report = {
        defect_id: document.getElementById('defect-id').value.trim(),
        title: document.getElementById('defect-title').value.trim(),
        description: document.getElementById('defect-description').value.trim(),
        steps: document.getElementById('defect-steps').value.trim() || null,
        expected: document.getElementById('defect-expected').value.trim() || null,
        actual: document.getElementById('defect-actual').value.trim() || null,
        environment: document.getElementById('defect-environment').value.trim() || null,
        logs: document.getElementById('defect-logs').value.trim() || null,
    };

    // Validate required fields
    if (!report.defect_id || !report.title || !report.description) {
        alert('Please fill in Defect ID, Title, and Description.');
        return;
    }

    // Show loading overlay
    showLoading(true);

    try {
        // Animate steps
        await animateLoadingStep('step-normalize', 400);
        await animateLoadingStep('step-embed', 600);
        await animateLoadingStep('step-search', 500);

        const response = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report),
        });

        await animateLoadingStep('step-cluster', 300);
        await animateLoadingStep('step-enhance', 300);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail?.message || `Analysis failed: ${response.status}`);
        }

        const result = await response.json();

        // Store for dashboard
        recentAnalyses.unshift({
            title: report.title,
            decision: result.decision,
            confidence: result.confidence,
        });
        if (result.decision !== 'new_defect') dashboardStats.dupes++;

        // Render results
        renderResults(result);

    } catch (e) {
        showLoading(false);
        renderError(e.message);
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.remove('hidden');
        document.querySelectorAll('.loading-step').forEach(s => {
            s.classList.remove('active', 'done');
        });
    } else {
        overlay.classList.add('hidden');
    }
}

async function animateLoadingStep(stepId, delay) {
    return new Promise(resolve => {
        const el = document.getElementById(stepId);
        if (el) {
            // Mark previous steps as done
            const allSteps = document.querySelectorAll('.loading-step');
            allSteps.forEach(s => {
                if (s.classList.contains('active')) {
                    s.classList.remove('active');
                    s.classList.add('done');
                }
            });
            el.classList.add('active');
        }
        setTimeout(resolve, delay);
    });
}

function renderResults(result) {
    showLoading(false);

    const panel = document.getElementById('results-panel');
    const decClass = result.decision === 'duplicate' ? 'decision-duplicate' :
        result.decision === 'possible_duplicate' ? 'decision-possible' : 'decision-new';
    const decText = result.decision === 'possible_duplicate' ? 'POSSIBLE DUPLICATE' :
        result.decision.replace('_', ' ').toUpperCase();

    // Decision color for confidence
    const confColor = result.confidence >= 0.9 ? 'var(--pink)' :
        result.confidence >= 0.75 ? 'var(--gold)' : 'var(--green)';

    // Matches HTML
    let matchesHtml = '';
    if (result.top_matches && result.top_matches.length > 0) {
        matchesHtml = result.top_matches.map(m => {
            const pct = (m.similarity_score * 100).toFixed(1);
            const barColor = m.similarity_score >= 0.9 ? 'var(--pink)' :
                m.similarity_score >= 0.75 ? 'var(--gold)' : 'var(--green)';
            return `
                <div class="match-card">
                    <span class="match-id">${escapeHtml(m.defect_id)}</span>
                    <span class="match-title">${escapeHtml(m.title)}</span>
                    <div class="match-bar-container">
                        <div class="match-bar">
                            <div class="match-bar-fill" style="width:${pct}%; background:${barColor}; box-shadow: 0 0 8px ${barColor};"></div>
                        </div>
                        <span class="match-score">${pct}%</span>
                    </div>
                </div>`;
        }).join('');
    } else {
        matchesHtml = '<p style="color:var(--text-muted);font-size:0.85rem;">No similar defects found in the database.</p>';
    }

    // Missing fields
    const ir = result.improved_report;
    let missingHtml = '';
    if (ir.missing_fields && ir.missing_fields.length > 0) {
        missingHtml = ir.missing_fields.map(f => `
            <div class="missing-field">
                <span class="missing-icon">⚠️</span>
                <div class="missing-info">
                    <div class="missing-name">${escapeHtml(f.field_name)}</div>
                    <div class="missing-suggestion">${escapeHtml(f.suggestion)}</div>
                </div>
            </div>`).join('');
    }

    // Completeness color
    const compPct = ir.completeness_score;
    const compColor = compPct >= 80 ? 'var(--green)' : compPct >= 50 ? 'var(--gold)' : 'var(--pink)';

    panel.innerHTML = `
        <div class="result-container">
            <div class="result-header">
                <span class="decision-badge-large ${decClass}">${decText}</span>
                <div style="flex:1;"></div>
                <div class="confidence-ring">
                    <div class="confidence-value" style="color:${confColor};">${(result.confidence * 100).toFixed(1)}%</div>
                    <div class="confidence-label">Confidence</div>
                </div>
            </div>

            <div class="matches-section">
                <h4>🔍 Top Matches (${result.top_matches?.length || 0})</h4>
                ${matchesHtml}
            </div>

            <div class="result-header" style="justify-content:center;">
                <div class="confidence-ring">
                    <div class="confidence-value" style="color:var(--purple);font-size:1.5rem;">#${result.cluster_id}</div>
                    <div class="confidence-label">Cluster ID</div>
                </div>
            </div>

            <div class="enhanced-section">
                <h4>✨ Enhanced Report</h4>
                <div class="enhanced-title">${escapeHtml(ir.improved_title)}</div>
                <div class="enhanced-summary">${escapeHtml(ir.summary)}</div>
                ${missingHtml ? `<h4 style="margin-top:16px;font-size:0.8rem;color:var(--orange);">⚠️ Missing Fields</h4>${missingHtml}` : ''}
                <div class="completeness-bar">
                    <div class="completeness-label">
                        <span>Completeness</span>
                        <span style="color:${compColor}">${compPct.toFixed(0)}%</span>
                    </div>
                    <div class="completeness-track">
                        <div class="completeness-fill" style="width:${compPct}%;background:${compColor};box-shadow:0 0 10px ${compColor};"></div>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderError(message) {
    const panel = document.getElementById('results-panel');
    panel.innerHTML = `
        <div class="result-container">
            <div class="result-header" style="border-color:rgba(255,55,95,0.3);">
                <span class="decision-badge-large decision-duplicate">ERROR</span>
                <div style="flex:1;">
                    <p style="color:var(--text-secondary);font-size:0.85rem;margin-left:12px;">${escapeHtml(message)}</p>
                </div>
            </div>
            <div class="enhanced-section" style="text-align:center;">
                <p style="color:var(--text-muted);">Make sure the backend server is running:</p>
                <pre class="code-block" style="text-align:left;margin-top:10px;"><code>uvicorn backend.main:app --reload --port 8000</code></pre>
            </div>
        </div>`;
}

// ─── Utilities ───
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    // Try loading dashboard data quietly
    loadDashboard().catch(() => { });
});
