import React, { useRef, useEffect } from 'react';

const AGENT_COLORS = ['#00e5ff', '#ff9800', '#2196f3', '#f44336', '#9c27b0', '#4caf50', '#795548', '#607d8b'];
const AGENT_SIZES = [
    [0.8, 2.0],   // 0: TWO_WHEELER
    [1.4, 2.6],   // 1: AUTO
    [1.8, 4.5],   // 2: CAR
    [2.5, 10.0],  // 3: BUS
    [0.4, 0.4],   // 4: PEDESTRIAN
    [0.6, 1.8],   // 5: BICYCLE
    [2.5, 12.0],  // 6: TRUCK
    [2.0, 6.0],   // 7: MEDIUM_VEHICLE
];

function resizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }
}

function drawRoads(ctx, roadData) {
    if (!roadData) return;
    
    // Draw junctions first (or after) to fill the gaps between edges
    if (roadData.junctions) {
        for (const junc of roadData.junctions) {
            if (!junc.shape || junc.shape.length < 3) continue;
            
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.moveTo(junc.shape[0][0], junc.shape[0][1]);
            for (let i = 1; i < junc.shape.length; i++) {
                ctx.lineTo(junc.shape[i][0], junc.shape[i][1]);
            }
            ctx.closePath();
            ctx.fill();
        }
    }
    
    if (!roadData.edges) return;
    
    for (const edge of roadData.edges) {
        if (edge.centerline.length < 2) continue;
        
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = edge.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(edge.centerline[0][0], edge.centerline[0][1]);
        for (let i = 1; i < edge.centerline.length; i++) {
            ctx.lineTo(edge.centerline[i][0], edge.centerline[i][1]);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 0.15;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(edge.centerline[0][0], edge.centerline[0][1]);
        for (let i = 1; i < edge.centerline.length; i++) {
            ctx.lineTo(edge.centerline[i][0], edge.centerline[i][1]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawObstacles(ctx, roadData) {
    if (!roadData) return;

    if (roadData.potholes) {
        for (const p of roadData.potholes) {
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
            ctx.lineWidth = 0.3;
            ctx.setLineDash([1, 1]);
            ctx.beginPath();
            ctx.arc(p.center[0], p.center[1], p.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = 'rgba(139, 90, 43, 0.3)';
            ctx.fill();
        }
    }

    if (roadData.barricades) {
        for (const b of roadData.barricades) {
            ctx.fillStyle = 'rgba(255, 60, 60, 0.7)';
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 0.2;
            ctx.beginPath();
            ctx.moveTo(b.hull[0][0], b.hull[0][1]);
            for (let i = 1; i < b.hull.length; i++) {
                ctx.lineTo(b.hull[i][0], b.hull[i][1]);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}

function drawAgents(ctx, agents) {
    for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (!a) continue;
        const [w, l] = AGENT_SIZES[a.type] || [1, 1];
        const color = AGENT_COLORS[a.type] || '#ffffff';

        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.heading); 

        ctx.fillStyle = color;
        ctx.fillRect(-l / 2, -w / 2, l, w);
        
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(l / 2, 0);
        ctx.lineTo(l / 2 - 0.5, -w / 3);
        ctx.lineTo(l / 2 - 0.5, w / 3);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

export default function SimulationCanvas({ agentsRef, roadData }) {
    const canvasRef = useRef(null);
    const transformRef = useRef({ offsetX: 0, offsetY: 0, scale: 1.0 });
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const initialFitDone = useRef(false);

    useEffect(() => {
        if (!roadData || !roadData.edges || roadData.edges.length === 0 || initialFitDone.current) return;
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        roadData.edges.forEach(edge => {
            edge.centerline.forEach(pt => {
                if (pt[0] < minX) minX = pt[0];
                if (pt[0] > maxX) maxX = pt[0];
                if (pt[1] < minY) minY = pt[1];
                if (pt[1] > maxY) maxY = pt[1];
            });
        });
        
        if (minX !== Infinity) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const width = maxX - minX;
            const height = maxY - minY;
            const scaleX = rect.width / (width * 1.1);
            const scaleY = rect.height / (height * 1.1);
            const scale = Math.min(scaleX, scaleY, 20.0);
            
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            transformRef.current = {
                offsetX: -centerX * scale,
                offsetY: centerY * scale, // note: Y is flipped in setTransform
                scale: scale
            };
            initialFitDone.current = true;
        }
    }, [roadData]);

    useEffect(() => {
        const canvas = canvasRef.current;
        let animId;

        const render = () => {
            resizeCanvas(canvas);
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            ctx.restore();

            const transform = transformRef.current;
            ctx.save();
            ctx.setTransform(
                transform.scale * dpr, 0, 0,
                -transform.scale * dpr, 
                transform.offsetX * dpr + canvas.width / 2,
                transform.offsetY * dpr + canvas.height / 2
            );

            drawRoads(ctx, roadData);
            drawObstacles(ctx, roadData);
            if (agentsRef.current) {
                drawAgents(ctx, agentsRef.current);
            }
            
            ctx.restore();
            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, [roadData]);

    const handleWheel = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const transform = transformRef.current;
        
        let newScale = transform.scale * zoomFactor;
        newScale = Math.max(0.1, Math.min(newScale, 20.0));
        
        const actualZoom = newScale / transform.scale;
        
        transform.offsetX = mouseX - (mouseX - transform.offsetX) * actualZoom;
        transform.offsetY = mouseY - (mouseY - transform.offsetY) * actualZoom;
        transform.scale = newScale;
    };

    const handleMouseDown = (e) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        
        transformRef.current.offsetX += dx;
        transformRef.current.offsetY += dy;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            style={{ width: '100vw', height: '100vh', display: 'block', cursor: isDragging.current ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
    );
}
