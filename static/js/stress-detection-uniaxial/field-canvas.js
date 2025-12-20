// ==================== 预览画布模块 ====================
// 功能：形状绘制、测点标记、网格显示、交互

const FieldCanvas = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let canvas = null;
    let ctx = null;
    let callbacks = null;
    
    // 显示设置
    let 显示设置 = {
        显示网格: true,
        显示刻度: true,
        显示测点编号: true,
        显示测点路径: false,
        缩放比例: 1,
        偏移X: 0,
        偏移Y: 0
    };
    
    // 高亮的测点ID
    let 高亮测点ID = null;
    
    // ========== 初始化 ==========
    function 初始化(state, canvasElement, cbs) {
        实验状态 = state;
        canvas = canvasElement;
        callbacks = cbs;
        
        if (canvas) {
            ctx = canvas.getContext('2d');
            绑定事件();
            调整尺寸();
        }
        
        console.log('[预览画布] 模块初始化完成');
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        if (!canvas) return;
        
        // 点击事件
        canvas.addEventListener('click', 处理点击);
        
        // 鼠标移动（悬停提示）
        canvas.addEventListener('mousemove', 处理鼠标移动);
        
        // 鼠标离开
        canvas.addEventListener('mouseleave', () => {
            隐藏提示();
        });
        
        // 窗口大小变化
        window.addEventListener('resize', debounce(调整尺寸, 200));
    }
    
    // ========== 调整尺寸 ==========
    function 调整尺寸() {
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        
        刷新();
    }
    
    // ========== 刷新画布 ==========
    function 刷新() {
        if (!canvas || !ctx) return;
        
        // 确保画布尺寸正确（解决首次渲染时尺寸为0的问题）
        const container = canvas.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const dpr = window.devicePixelRatio || 1;
                if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                    canvas.width = rect.width * dpr;
                    canvas.height = rect.height * dpr;
                    canvas.style.width = rect.width + 'px';
                    canvas.style.height = rect.height + 'px';
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(dpr, dpr);
                }
            }
        }
        
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        
        // 如果尺寸为0，延迟刷新
        if (width <= 0 || height <= 0) {
            requestAnimationFrame(刷新);
            return;
        }
        
        // 清空画布
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        // 计算变换参数
        const transform = 计算变换参数(width, height);
        
        // 绘制网格
        if (显示设置.显示网格) {
            绘制网格(width, height, transform);
        }
        
        // 绘制形状
        if (实验状态?.形状配置) {
            绘制形状(transform);
        }
        
        // 绘制测点
        if (实验状态?.测点列表?.length > 0) {
            绘制测点(transform);
        }
        
        // 绘制刻度
        if (显示设置.显示刻度) {
            绘制刻度(width, height, transform);
        }
    }
    
    // ========== 计算变换参数 ==========
    function 计算变换参数(canvasWidth, canvasHeight) {
        const padding = 40;
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;
        
        // 获取形状边界
        let bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        
        if (实验状态?.形状配置) {
            bounds = 获取形状边界(实验状态.形状配置);
        }
        
        const shapeWidth = bounds.maxX - bounds.minX;
        const shapeHeight = bounds.maxY - bounds.minY;
        
        // 计算缩放比例（保持宽高比）
        const scaleX = availableWidth / shapeWidth;
        const scaleY = availableHeight / shapeHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9;
        
        // 计算偏移（居中）
        const offsetX = padding + (availableWidth - shapeWidth * scale) / 2 - bounds.minX * scale;
        const offsetY = padding + (availableHeight - shapeHeight * scale) / 2 - bounds.minY * scale;
        
        return { scale, offsetX, offsetY, bounds };
    }
    
    // ========== 获取形状边界 ==========
    function 获取形状边界(config) {
        let minX = 0, maxX = 100, minY = 0, maxY = 100;
        
        switch (config.type) {
            case 'rectangle':
                minX = 0;
                maxX = config.width || 100;
                minY = 0;
                maxY = config.height || 100;
                break;
                
            case 'circle':
                const cx = config.centerX || 50;
                const cy = config.centerY || 50;
                const r = config.outerRadius || 50;
                minX = cx - r;
                maxX = cx + r;
                minY = cy - r;
                maxY = cy + r;
                break;
                
            case 'polygon':
                if (config.vertices && config.vertices.length > 0) {
                    minX = Math.min(...config.vertices.map(v => v[0]));
                    maxX = Math.max(...config.vertices.map(v => v[0]));
                    minY = Math.min(...config.vertices.map(v => v[1]));
                    maxY = Math.max(...config.vertices.map(v => v[1]));
                }
                break;
        }
        
        return { minX, maxX, minY, maxY };
    }
    
    // ========== 绘制网格 ==========
    function 绘制网格(width, height, transform) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        
        const gridSize = 10;  // 10mm网格
        const { scale, offsetX, offsetY, bounds } = transform;
        
        // 垂直线
        for (let x = Math.floor(bounds.minX / gridSize) * gridSize; x <= bounds.maxX; x += gridSize) {
            const screenX = x * scale + offsetX;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, height);
            ctx.stroke();
        }
        
        // 水平线
        for (let y = Math.floor(bounds.minY / gridSize) * gridSize; y <= bounds.maxY; y += gridSize) {
            const screenY = y * scale + offsetY;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(width, screenY);
            ctx.stroke();
        }
    }
    
    // ========== 绘制形状 ==========
    function 绘制形状(transform) {
        const config = 实验状态.形状配置;
        const { scale, offsetX, offsetY } = transform;
        
        ctx.fillStyle = 'rgba(100, 149, 237, 0.2)';
        ctx.strokeStyle = '#4169e1';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        
        switch (config.type) {
            case 'rectangle':
                const rx = 0 * scale + offsetX;
                const ry = 0 * scale + offsetY;
                const rw = config.width * scale;
                const rh = config.height * scale;
                ctx.rect(rx, ry, rw, rh);
                break;
                
            case 'circle':
                const cx = config.centerX * scale + offsetX;
                const cy = config.centerY * scale + offsetY;
                const outerR = config.outerRadius * scale;
                
                if (config.startAngle !== undefined && config.endAngle !== undefined && 
                    (config.startAngle !== 0 || config.endAngle !== 360)) {
                    // 扇形
                    const startRad = (config.startAngle - 90) * Math.PI / 180;
                    const endRad = (config.endAngle - 90) * Math.PI / 180;
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx, cy, outerR, startRad, endRad);
                    ctx.closePath();
                } else {
                    // 完整圆
                    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
                }
                
                // 内圆（环形）
                if (config.innerRadius && config.innerRadius > 0) {
                    const innerR = config.innerRadius * scale;
                    ctx.moveTo(cx + innerR, cy);
                    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
                }
                break;
                
            case 'polygon':
                if (config.vertices && config.vertices.length >= 3) {
                    const first = config.vertices[0];
                    ctx.moveTo(first[0] * scale + offsetX, first[1] * scale + offsetY);
                    for (let i = 1; i < config.vertices.length; i++) {
                        const v = config.vertices[i];
                        ctx.lineTo(v[0] * scale + offsetX, v[1] * scale + offsetY);
                    }
                    ctx.closePath();
                }
                break;
        }
        
        ctx.fill();
        ctx.stroke();
        
        // 绘制孔洞
        if (config.modifiers && config.modifiers.length > 0) {
            ctx.fillStyle = '#f8f9fa';
            ctx.strokeStyle = '#dc3545';
            ctx.lineWidth = 1.5;
            
            config.modifiers.forEach(mod => {
                if (mod.op === 'subtract') {
                    ctx.beginPath();
                    if (mod.shape === 'circle') {
                        const hcx = mod.centerX * scale + offsetX;
                        const hcy = mod.centerY * scale + offsetY;
                        const hr = mod.radius * scale;
                        ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
                    } else if (mod.shape === 'rectangle') {
                        const hx = mod.x * scale + offsetX;
                        const hy = mod.y * scale + offsetY;
                        const hw = mod.width * scale;
                        const hh = mod.height * scale;
                        ctx.rect(hx, hy, hw, hh);
                    }
                    ctx.fill();
                    ctx.stroke();
                }
            });
        }
    }
    
    // ========== 绘制测点 ==========
    function 绘制测点(transform) {
        const points = 实验状态.测点列表;
        const { scale, offsetX, offsetY } = transform;
        const currentIndex = 实验状态.当前测点索引;
        
        // 绘制测点路径
        if (显示设置.显示测点路径 && points.length > 1) {
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            points.forEach((p, i) => {
                const x = p.x * scale + offsetX;
                const y = p.y * scale + offsetY;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 绘制测点
        points.forEach((point, index) => {
            const x = point.x * scale + offsetX;
            const y = point.y * scale + offsetY;
            const radius = 6;
            
            // 确定颜色
            let fillColor, strokeColor;
            const isHighlighted = point.id === 高亮测点ID || index === currentIndex;
            
            switch (point.status) {
                case 'measured':
                    fillColor = '#28a745';
                    strokeColor = '#1e7e34';
                    break;
                case 'skipped':
                    fillColor = '#fd7e14';
                    strokeColor = '#e06000';
                    break;
                case 'error':
                    fillColor = '#dc3545';
                    strokeColor = '#bd2130';
                    break;
                default:  // pending
                    fillColor = '#6c757d';
                    strokeColor = '#545b62';
            }
            
            // 当前测点高亮
            if (index === currentIndex) {
                fillColor = '#ffc107';
                strokeColor = '#d39e00';
            }
            
            // 绘制测点
            ctx.beginPath();
            ctx.arc(x, y, isHighlighted ? radius * 1.5 : radius, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isHighlighted ? 3 : 2;
            ctx.stroke();
            
            // 绘制编号
            if (显示设置.显示测点编号) {
                ctx.fillStyle = '#333';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(point.id || index + 1, x, y - radius - 4);
            }
        });
    }
    
    // ========== 绘制刻度 ==========
    function 绘制刻度(width, height, transform) {
        const { scale, offsetX, offsetY, bounds } = transform;
        
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // X轴刻度
        const xStep = 计算刻度步长(bounds.maxX - bounds.minX);
        for (let x = Math.ceil(bounds.minX / xStep) * xStep; x <= bounds.maxX; x += xStep) {
            const screenX = x * scale + offsetX;
            ctx.fillText(x.toFixed(0), screenX, height - 5);
        }
        
        // Y轴刻度
        ctx.textAlign = 'right';
        const yStep = 计算刻度步长(bounds.maxY - bounds.minY);
        for (let y = Math.ceil(bounds.minY / yStep) * yStep; y <= bounds.maxY; y += yStep) {
            const screenY = y * scale + offsetY;
            ctx.fillText(y.toFixed(0), 35, screenY + 3);
        }
    }
    
    function 计算刻度步长(range) {
        const targetSteps = 5;
        const rawStep = range / targetSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalized = rawStep / magnitude;
        
        if (normalized <= 1) return magnitude;
        if (normalized <= 2) return 2 * magnitude;
        if (normalized <= 5) return 5 * magnitude;
        return 10 * magnitude;
    }
    
    // ========== 交互处理 ==========
    function 处理点击(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const point = 查找点击的测点(x, y);
        if (point) {
            callbacks?.选中测点?.(point.id);
        }
    }
    
    function 处理鼠标移动(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const point = 查找点击的测点(x, y);
        if (point) {
            显示提示(event.clientX, event.clientY, point);
            canvas.style.cursor = 'pointer';
        } else {
            隐藏提示();
            canvas.style.cursor = 'default';
        }
    }
    
    function 查找点击的测点(screenX, screenY) {
        if (!实验状态?.测点列表) return null;
        
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        const transform = 计算变换参数(width, height);
        const { scale, offsetX, offsetY } = transform;
        
        const hitRadius = 10;
        
        for (const point of 实验状态.测点列表) {
            const px = point.x * scale + offsetX;
            const py = point.y * scale + offsetY;
            const dist = Math.sqrt((screenX - px) ** 2 + (screenY - py) ** 2);
            if (dist <= hitRadius) {
                return point;
            }
        }
        
        return null;
    }
    
    // ========== 提示框 ==========
    function 显示提示(x, y, point) {
        let tooltip = document.getElementById('field-canvas-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'field-canvas-tooltip';
            tooltip.className = 'canvas-tooltip';
            document.body.appendChild(tooltip);
        }
        
        const statusText = {
            'pending': '待测',
            'measured': '已测',
            'skipped': '已跳过',
            'error': '错误'
        };
        
        tooltip.innerHTML = `
            <div><strong>测点 ${point.id}</strong></div>
            <div>位置: (${point.x?.toFixed(1)}, ${point.y?.toFixed(1)})</div>
            <div>状态: ${statusText[point.status] || '待测'}</div>
            ${point.stress !== undefined ? `<div>应力: ${point.stress.toFixed(1)} MPa</div>` : ''}
        `;
        
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y + 15) + 'px';
        tooltip.style.display = 'block';
    }
    
    function 隐藏提示() {
        const tooltip = document.getElementById('field-canvas-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    // ========== 高亮测点 ==========
    function 高亮测点(pointId) {
        高亮测点ID = pointId;
        刷新();
        
        // 3秒后取消高亮
        setTimeout(() => {
            if (高亮测点ID === pointId) {
                高亮测点ID = null;
                刷新();
            }
        }, 3000);
    }
    
    // ========== 清空 ==========
    function 清空() {
        高亮测点ID = null;
        if (canvas && ctx) {
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);
        }
    }
    
    // ========== 工具函数 ==========
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        调整尺寸,
        刷新,
        高亮测点,
        清空
    };
})();
