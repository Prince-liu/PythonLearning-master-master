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
    
    // 拖动状态
    let 拖动状态 = {
        正在拖动: false,
        起始X: 0,
        起始Y: 0,
        起始偏移X: 0,
        起始偏移Y: 0
    };
    
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
            拖动状态.正在拖动 = false;
            canvas.style.cursor = 'default';
        });
        
        // 滚轮缩放
        canvas.addEventListener('wheel', 处理滚轮缩放, { passive: false });
        
        // 拖动平移
        canvas.addEventListener('mousedown', 处理拖动开始);
        canvas.addEventListener('mousemove', 处理拖动中);
        canvas.addEventListener('mouseup', 处理拖动结束);
        
        // 双击重置视图
        canvas.addEventListener('dblclick', 重置视图);
        
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
        
        // 获取形状边界
        let bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        if (实验状态?.形状配置) {
            bounds = 获取形状边界(实验状态.形状配置);
        }
        
        // 计算变换参数
        const transform = 计算变换参数(width, height, bounds);
        
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
    function 计算变换参数(canvasWidth, canvasHeight, bounds) {
        const paddingTop = 20;     // 减小顶部padding
        const paddingRight = 40;
        const paddingBottom = 60;  // 增加底部padding，给X轴刻度和标签留更多空间
        const paddingLeft = 50;    // 增加左侧padding，给Y轴刻度留空间
        
        const availableWidth = canvasWidth - paddingLeft - paddingRight;
        const availableHeight = canvasHeight - paddingTop - paddingBottom;
        
        const shapeWidth = bounds.maxX - bounds.minX;
        const shapeHeight = bounds.maxY - bounds.minY;
        
        // 防止可用空间为负数或零时导致的计算错误
        if (availableWidth <= 0 || availableHeight <= 0 || shapeWidth <= 0 || shapeHeight <= 0) {
            return { scale: 1, offsetX: 0, offsetY: canvasHeight, bounds };
        }
        
        // 计算基础缩放比例（保持宽高比）
        const scaleX = availableWidth / shapeWidth;
        const scaleY = availableHeight / shapeHeight;
        const baseScale = Math.min(scaleX, scaleY) * 0.9;
        
        // 应用用户缩放
        const scale = baseScale * 显示设置.缩放比例;
        
        // 计算基础偏移（居中）
        const baseOffsetX = paddingLeft + (availableWidth - shapeWidth * baseScale) / 2 - bounds.minX * baseScale;
        const baseOffsetY = canvasHeight - paddingBottom - (availableHeight - shapeHeight * baseScale) / 2 - bounds.minY * baseScale;
        
        // 应用用户偏移（考虑缩放比例）
        const offsetX = baseOffsetX * 显示设置.缩放比例 + 显示设置.偏移X + (1 - 显示设置.缩放比例) * canvasWidth / 2;
        const offsetY = baseOffsetY * 显示设置.缩放比例 + 显示设置.偏移Y + (1 - 显示设置.缩放比例) * canvasHeight / 2;
        
        return { scale, offsetX, offsetY, bounds };
    }
    
    // ========== 获取形状边界 ==========
    // 边界始终包含原点(0,0)，确保坐标轴和图形都在画面中
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
                // 包含原点和圆形
                minX = Math.min(0, cx - r);
                maxX = Math.max(0, cx + r);
                minY = Math.min(0, cy - r);
                maxY = Math.max(0, cy + r);
                break;
                
            case 'polygon':
                if (config.vertices && config.vertices.length > 0) {
                    // 包含原点和多边形
                    minX = Math.min(0, ...config.vertices.map(v => v[0]));
                    maxX = Math.max(0, ...config.vertices.map(v => v[0]));
                    minY = Math.min(0, ...config.vertices.map(v => v[1]));
                    maxY = Math.max(0, ...config.vertices.map(v => v[1]));
                }
                break;
        }
        
        return { minX, maxX, minY, maxY };
    }
    
    // ========== 绘制网格 ==========
    function 绘制网格(width, height, transform) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        
        const { scale, offsetX, offsetY, bounds } = transform;
        
        // 根据工件尺寸自适应网格间距
        const shapeWidth = bounds.maxX - bounds.minX;
        const shapeHeight = bounds.maxY - bounds.minY;
        const maxDimension = Math.max(shapeWidth, shapeHeight);
        
        let gridSize;
        if (maxDimension <= 100) {
            gridSize = 10;
        } else if (maxDimension <= 500) {
            gridSize = 50;
        } else if (maxDimension <= 2000) {
            gridSize = 100;
        } else {
            gridSize = 200;
        }
        
        // 垂直线
        for (let x = Math.floor(bounds.minX / gridSize) * gridSize; x <= bounds.maxX; x += gridSize) {
            const screenX = x * scale + offsetX;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, height);
            ctx.stroke();
        }
        
        // 水平线（Y轴翻转）
        for (let y = Math.floor(bounds.minY / gridSize) * gridSize; y <= bounds.maxY; y += gridSize) {
            const screenY = offsetY - y * scale;  // Y轴翻转：减去而不是加上
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
                const ry = offsetY - config.height * scale;  // Y轴翻转
                const rw = config.width * scale;
                const rh = config.height * scale;
                ctx.rect(rx, ry, rw, rh);
                break;
                
            case 'circle':
                const cx = config.centerX * scale + offsetX;
                const cy = offsetY - config.centerY * scale;  // Y轴翻转
                const outerR = config.outerRadius * scale;
                
                if (config.startAngle !== undefined && config.endAngle !== undefined && 
                    (config.startAngle !== 0 || config.endAngle !== 360)) {
                    // 扇形（角度需要翻转）
                    const startRad = (-config.startAngle + 90) * Math.PI / 180;  // 角度翻转
                    const endRad = (-config.endAngle + 90) * Math.PI / 180;
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx, cy, outerR, startRad, endRad, true);  // 逆时针
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
                    ctx.moveTo(first[0] * scale + offsetX, offsetY - first[1] * scale);  // Y轴翻转
                    for (let i = 1; i < config.vertices.length; i++) {
                        const v = config.vertices[i];
                        ctx.lineTo(v[0] * scale + offsetX, offsetY - v[1] * scale);  // Y轴翻转
                    }
                    ctx.closePath();
                }
                break;
        }
        
        ctx.fill();
        ctx.stroke();
        
        // 绘制孔洞（使用裁剪，只显示形状内部的孔洞边框）
        if (config.modifiers && config.modifiers.length > 0) {
            ctx.save();  // 保存当前状态
            
            // 创建形状裁剪路径
            ctx.beginPath();
            switch (config.type) {
                case 'rectangle':
                    const crx = 0 * scale + offsetX;
                    const cry = offsetY - config.height * scale;
                    const crw = config.width * scale;
                    const crh = config.height * scale;
                    ctx.rect(crx, cry, crw, crh);
                    break;
                    
                case 'circle':
                    const ccx = config.centerX * scale + offsetX;
                    const ccy = offsetY - config.centerY * scale;
                    const couterR = config.outerRadius * scale;
                    
                    if (config.startAngle !== undefined && config.endAngle !== undefined && 
                        (config.startAngle !== 0 || config.endAngle !== 360)) {
                        const cstartRad = (-config.startAngle + 90) * Math.PI / 180;
                        const cendRad = (-config.endAngle + 90) * Math.PI / 180;
                        ctx.moveTo(ccx, ccy);
                        ctx.arc(ccx, ccy, couterR, cstartRad, cendRad, true);
                        ctx.closePath();
                    } else {
                        ctx.arc(ccx, ccy, couterR, 0, Math.PI * 2);
                    }
                    break;
                    
                case 'polygon':
                    if (config.vertices && config.vertices.length >= 3) {
                        const cfirst = config.vertices[0];
                        ctx.moveTo(cfirst[0] * scale + offsetX, offsetY - cfirst[1] * scale);
                        for (let i = 1; i < config.vertices.length; i++) {
                            const cv = config.vertices[i];
                            ctx.lineTo(cv[0] * scale + offsetX, offsetY - cv[1] * scale);
                        }
                        ctx.closePath();
                    }
                    break;
            }
            ctx.clip();  // 应用裁剪
            
            // 在裁剪区域内绘制孔洞
            ctx.fillStyle = '#f8f9fa';
            ctx.strokeStyle = '#dc3545';
            ctx.lineWidth = 1.5;
            
            config.modifiers.forEach(mod => {
                if (mod.op === 'subtract') {
                    ctx.beginPath();
                    if (mod.shape === 'circle') {
                        const hcx = mod.centerX * scale + offsetX;
                        const hcy = offsetY - mod.centerY * scale;
                        const hr = mod.radius * scale;
                        // 防止负半径导致的 IndexSizeError
                        if (hr > 0) {
                            ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
                        }
                    } else if (mod.shape === 'rectangle') {
                        const hx = mod.x * scale + offsetX;
                        const hy = offsetY - (mod.y + mod.height) * scale;
                        const hw = mod.width * scale;
                        const hh = mod.height * scale;
                        ctx.rect(hx, hy, hw, hh);
                    }
                    ctx.fill();
                    ctx.stroke();
                }
            });
            
            ctx.restore();  // 恢复裁剪状态
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
                const y = offsetY - p.y * scale;  // Y轴翻转
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 计算是否显示编号（基于测点密度）
        const shouldShowLabels = 计算是否显示编号(points, scale, offsetX, offsetY);
        
        // 绘制测点
        points.forEach((point, index) => {
            const px = point.x_coord ?? point.x ?? 0;
            const py = point.y_coord ?? point.y ?? 0;
            const x = px * scale + offsetX;
            const y = offsetY - py * scale;  // Y轴翻转
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
            
            // 绘制编号（根据密度和高亮状态决定是否显示）
            if (显示设置.显示测点编号 && (shouldShowLabels || isHighlighted)) {
                ctx.fillStyle = '#333';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(point.point_index ?? point.id ?? (index + 1), x, y - radius - 4);
            }
        });
    }
    
    // ========== 计算是否显示编号 ==========
    // 根据测点在屏幕上的密度决定是否显示编号
    function 计算是否显示编号(points, scale, offsetX, offsetY) {
        if (!points || points.length === 0) return true;
        if (points.length === 1) return true;  // 只有一个点，总是显示
        
        // 计算所有测点的屏幕坐标
        const screenPoints = points.map(p => ({
            x: (p.x_coord ?? p.x ?? 0) * scale + offsetX,
            y: offsetY - (p.y_coord ?? p.y ?? 0) * scale
        }));
        
        // 计算最小距离
        let minDistance = Infinity;
        for (let i = 0; i < screenPoints.length; i++) {
            for (let j = i + 1; j < screenPoints.length; j++) {
                const dx = screenPoints[i].x - screenPoints[j].x;
                const dy = screenPoints[i].y - screenPoints[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistance) {
                    minDistance = dist;
                }
            }
        }
        
        // 如果最小距离小于阈值，隐藏编号
        const minSpacing = 25;  // 最小像素间距阈值
        return minDistance >= minSpacing;
    }
    
    // ========== 绘制刻度 ==========
    // 原始风格：刻度贴在网格边缘，无坐标轴线，从0开始
    function 绘制刻度(width, height, transform) {
        const { scale, offsetX, offsetY, bounds } = transform;
        
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial';
        
        // 扩展边界到0（确保刻度从0开始）
        const displayMinX = Math.min(0, bounds.minX);
        const displayMaxX = bounds.maxX;
        const displayMinY = Math.min(0, bounds.minY);
        const displayMaxY = bounds.maxY;
        
        // 计算像素范围（用于判断刻度密度）
        const xPixelRange = (displayMaxX - displayMinX) * scale;
        const yPixelRange = (displayMaxY - displayMinY) * scale;
        
        // X轴刻度（底部，紧贴网格下方，跳过0）
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const xStep = 计算刻度步长(displayMaxX - displayMinX, xPixelRange);
        for (let x = Math.ceil(displayMinX / xStep) * xStep; x <= displayMaxX; x += xStep) {
            if (x === 0) continue;  // 跳过0，单独绘制原点
            const screenX = x * scale + offsetX;
            // 只显示在画布可见范围内的刻度
            if (screenX >= 30 && screenX <= width - 10) {
                const screenY = offsetY - displayMinY * scale;  // 网格底部位置
                ctx.fillText(x.toFixed(0), screenX, screenY + 8);
            }
        }
        
        // Y轴刻度（左侧，紧贴网格左侧，跳过0）
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const yStep = 计算刻度步长(displayMaxY - displayMinY, yPixelRange);
        for (let y = Math.ceil(displayMinY / yStep) * yStep; y <= displayMaxY; y += yStep) {
            if (y === 0) continue;  // 跳过0，单独绘制原点
            const screenY = offsetY - y * scale;  // Y轴翻转
            // 只显示在画布可见范围内的刻度
            if (screenY >= 10 && screenY <= height - 20) {
                const screenX = displayMinX * scale + offsetX;  // 网格左侧位置
                ctx.fillText(y.toFixed(0), screenX - 10, screenY);
            }
        }
        
        // 原点标注（0，显示在左下角）
        const originX = 0 * scale + offsetX;
        const originY = offsetY - 0 * scale;
        // 只在原点可见时显示
        if (originX >= 20 && originX <= width - 10 && originY >= 10 && originY <= height - 10) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText('0', originX - 5, originY + 5);
        }
    }
    
    // 计算刻度步长，同时考虑数值范围和像素空间
    function 计算刻度步长(range, pixelRange) {
        const minPixelSpacing = 30;  // 相邻刻度之间最小像素间距
        
        // 防止无效输入
        if (range <= 0 || pixelRange <= 0) return 10;
        
        // 基于数值范围计算理想步长
        const targetSteps = 5;
        const rawStep = range / targetSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalized = rawStep / magnitude;
        
        let step;
        if (normalized <= 1) step = magnitude;
        else if (normalized <= 2) step = 2 * magnitude;
        else if (normalized <= 5) step = 5 * magnitude;
        else step = 10 * magnitude;
        
        // 检查像素间距是否足够，不够就增大步长
        let pixelSpacing = (step / range) * pixelRange;
        while (pixelSpacing < minPixelSpacing && step < range) {
            step *= 2;
            pixelSpacing = (step / range) * pixelRange;
        }
        
        return step;
    }
    
    // ========== 交互处理 ==========
    function 处理点击(event) {
        // 如果刚刚拖动过，不触发点击
        if (拖动状态.正在拖动) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const point = 查找点击的测点(x, y);
        if (point) {
            callbacks?.选中测点?.(point.id);
        }
    }
    
    function 处理鼠标移动(event) {
        // 如果正在拖动，不显示提示
        if (拖动状态.正在拖动) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const point = 查找点击的测点(x, y);
        if (point) {
            显示提示(event.clientX, event.clientY, point);
            canvas.style.cursor = 'pointer';
        } else {
            隐藏提示();
            canvas.style.cursor = 'grab';
        }
    }
    
    // ========== 滚轮缩放 ==========
    function 处理滚轮缩放(event) {
        event.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // 缩放因子
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = 显示设置.缩放比例 * zoomFactor;
        
        // 限制缩放范围
        if (newZoom < 0.1 || newZoom > 10) return;
        
        // 以鼠标位置为中心缩放
        const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
        
        // 计算新的偏移，使鼠标位置保持不变
        const dx = mouseX - canvasWidth / 2;
        const dy = mouseY - canvasHeight / 2;
        
        显示设置.偏移X = 显示设置.偏移X * zoomFactor - dx * (zoomFactor - 1);
        显示设置.偏移Y = 显示设置.偏移Y * zoomFactor - dy * (zoomFactor - 1);
        显示设置.缩放比例 = newZoom;
        
        刷新();
    }
    
    // ========== 拖动平移 ==========
    function 处理拖动开始(event) {
        // 检查是否点击在测点上
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const point = 查找点击的测点(x, y);
        
        // 如果点击在测点上，不开始拖动
        if (point) return;
        
        拖动状态.正在拖动 = true;
        拖动状态.起始X = event.clientX;
        拖动状态.起始Y = event.clientY;
        拖动状态.起始偏移X = 显示设置.偏移X;
        拖动状态.起始偏移Y = 显示设置.偏移Y;
        canvas.style.cursor = 'grabbing';
        隐藏提示();
    }
    
    function 处理拖动中(event) {
        if (!拖动状态.正在拖动) return;
        
        const dx = event.clientX - 拖动状态.起始X;
        const dy = event.clientY - 拖动状态.起始Y;
        
        显示设置.偏移X = 拖动状态.起始偏移X + dx;
        显示设置.偏移Y = 拖动状态.起始偏移Y + dy;
        
        刷新();
    }
    
    function 处理拖动结束(event) {
        if (拖动状态.正在拖动) {
            拖动状态.正在拖动 = false;
            canvas.style.cursor = 'grab';
            
            // 延迟重置拖动状态，避免触发点击事件
            setTimeout(() => {
                拖动状态.正在拖动 = false;
            }, 50);
        }
    }
    
    // ========== 重置视图 ==========
    function 重置视图() {
        显示设置.缩放比例 = 1;
        显示设置.偏移X = 0;
        显示设置.偏移Y = 0;
        刷新();
    }
    
    function 查找点击的测点(screenX, screenY) {
        if (!实验状态?.测点列表) return null;
        
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        
        // 获取形状边界
        let bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        if (实验状态?.形状配置) {
            bounds = 获取形状边界(实验状态.形状配置);
        }
        
        const transform = 计算变换参数(width, height, bounds);
        const { scale, offsetX, offsetY } = transform;
        
        const hitRadius = 10;
        
        for (const point of 实验状态.测点列表) {
            const pointX = point.x_coord ?? point.x ?? 0;
            const pointY = point.y_coord ?? point.y ?? 0;
            const px = pointX * scale + offsetX;
            const py = offsetY - pointY * scale;  // Y轴翻转
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
        
        const tooltipX = point.x_coord ?? point.x ?? 0;
        const tooltipY = point.y_coord ?? point.y ?? 0;
        tooltip.innerHTML = `
            <div><strong>测点 ${point.point_index ?? point.id}</strong></div>
            <div>位置: (${tooltipX.toFixed(1)}, ${tooltipY.toFixed(1)})</div>
            <div>状态: ${statusText[point.status] || '待测'}</div>
            ${point.stress_value != null ? `<div>应力: ${point.stress_value.toFixed(1)} MPa</div>` : ''}
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
        显示设置.缩放比例 = 1;
        显示设置.偏移X = 0;
        显示设置.偏移Y = 0;
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
        清空,
        重置视图
    };
})();
