// ==================== 云图显示模块 ====================
// 功能：云图绘制、色标显示、交互、导出

const FieldContour = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let canvas = null;
    let ctx = null;
    let callbacks = null;
    
    // 云图数据
    let 云图数据 = null;
    
    // 显示设置
    let 显示设置 = {
        显示测点: true,
        显示等高线: true,
        色图名称: 'jet',
        透明度: 0.8
    };
    
    // 色图定义
    const 色图 = {
        jet: [
            [0, 0, 0.5], [0, 0, 1], [0, 0.5, 1], [0, 1, 1],
            [0.5, 1, 0.5], [1, 1, 0], [1, 0.5, 0], [1, 0, 0], [0.5, 0, 0]
        ],
        hot: [
            [0, 0, 0], [0.5, 0, 0], [1, 0, 0], [1, 0.5, 0], [1, 1, 0], [1, 1, 1]
        ],
        cool: [
            [0, 1, 1], [1, 0, 1]
        ],
        viridis: [
            [0.267, 0.004, 0.329], [0.282, 0.140, 0.458], [0.253, 0.265, 0.530],
            [0.206, 0.372, 0.553], [0.163, 0.471, 0.558], [0.127, 0.566, 0.551],
            [0.134, 0.658, 0.518], [0.267, 0.749, 0.441], [0.478, 0.821, 0.318],
            [0.741, 0.873, 0.150], [0.993, 0.906, 0.144]
        ]
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
        
        console.log('[云图显示] 模块初始化完成');
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        if (!canvas) return;
        
        canvas.addEventListener('mousemove', 处理鼠标移动);
        canvas.addEventListener('mouseleave', 隐藏提示);
        canvas.addEventListener('click', 处理点击);
        
        window.addEventListener('resize', debounce(调整尺寸, 200));
        
        // 绑定设置面板事件
        绑定设置面板事件();
    }
    
    // ========== 设置面板事件绑定 ==========
    function 绑定设置面板事件() {
        // 显示测点复选框
        const showPointsCheckbox = document.getElementById('field-contour-show-points');
        if (showPointsCheckbox) {
            showPointsCheckbox.addEventListener('change', (e) => {
                显示设置.显示测点 = e.target.checked;
                刷新();
            });
        }
        
        // 显示等高线复选框
        const showContourLinesCheckbox = document.getElementById('field-contour-show-contour-lines');
        if (showContourLinesCheckbox) {
            showContourLinesCheckbox.addEventListener('change', (e) => {
                显示设置.显示等高线 = e.target.checked;
                刷新();
            });
        }
        
        // 刷新云图按钮
        const refreshBtn = document.getElementById('field-contour-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                if (callbacks?.显示状态信息) {
                    callbacks.显示状态信息('⏳', '正在刷新云图...', '', 'info', 0);
                }
                
                try {
                    const expId = 实验状态?.当前实验?.experiment_id;
                    if (!expId) {
                        callbacks?.显示状态信息?.('⚠️', '请先加载实验', '', 'warning');
                        return;
                    }
                    
                    // 获取设置参数
                    const interpolation = document.getElementById('field-contour-interpolation')?.value || 'auto';
                    const resolution = parseInt(document.getElementById('field-contour-resolution')?.value || '100');
                    const minVal = document.getElementById('field-contour-min')?.value;
                    const maxVal = document.getElementById('field-contour-max')?.value;
                    
                    const result = await pywebview.api.update_field_contour(expId, {
                        method: interpolation,
                        resolution: resolution,
                        vmin: minVal ? parseFloat(minVal) : null,
                        vmax: maxVal ? parseFloat(maxVal) : null
                    });
                    
                    if (result.success) {
                        // update_field_contour 直接返回数据，不嵌套在 data 里
                        更新数据(result);
                        callbacks?.显示状态信息?.('✅', '云图已刷新', '', 'success');
                    } else {
                        callbacks?.显示状态信息?.('❌', '刷新失败', result.error || result.message, 'error');
                    }
                } catch (error) {
                    console.error('[云图显示] 刷新失败:', error);
                    callbacks?.显示状态信息?.('❌', '刷新失败', error.toString(), 'error');
                }
            });
        }
        
        // 导出图片按钮
        const exportBtn = document.getElementById('field-contour-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', 导出云图图片);
        }
    }
    
    // ========== 导出云图图片 ==========
    async function 导出云图图片() {
        if (!canvas) {
            callbacks?.显示状态信息?.('⚠️', '画布未初始化', '', 'warning');
            return;
        }
        
        try {
            // 创建高分辨率画布
            const exportCanvas = document.createElement('canvas');
            const scale = 2;  // 2倍分辨率
            exportCanvas.width = canvas.width * scale / (window.devicePixelRatio || 1);
            exportCanvas.height = canvas.height * scale / (window.devicePixelRatio || 1);
            
            const exportCtx = exportCanvas.getContext('2d');
            exportCtx.scale(scale, scale);
            
            // 复制当前画布内容
            exportCtx.drawImage(canvas, 0, 0, 
                canvas.width / (window.devicePixelRatio || 1), 
                canvas.height / (window.devicePixelRatio || 1));
            
            // 转换为blob并下载
            exportCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const expName = 实验状态?.当前实验?.name || 'contour';
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
                a.download = `${expName}_云图_${timestamp}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                callbacks?.显示状态信息?.('✅', '云图已导出', '', 'success');
            }, 'image/png');
            
        } catch (error) {
            console.error('[云图显示] 导出失败:', error);
            callbacks?.显示状态信息?.('❌', '导出失败', error.toString(), 'error');
        }
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
    
    // ========== 更新数据 ==========
    function 更新数据(data) {
        云图数据 = data;
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
        
        if (!云图数据) {
            绘制空状态(width, height);
            return;
        }
        
        // 计算变换参数
        const transform = 计算变换参数(width, height);
        
        // 绘制云图
        if (云图数据.mode === 'contour' && 云图数据.grid) {
            绘制云图(transform);
        }
        
        // 绘制测点
        if (显示设置.显示测点 && 云图数据.points) {
            绘制测点(transform);
        }
        
        // 绘制色标
        绘制色标(width, height);
        
        // 绘制置信度标签
        绘制置信度标签(width, height);
    }
    
    // ========== 绘制空状态 ==========
    function 绘制空状态(width, height) {
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无云图数据', width / 2, height / 2 - 10);
        ctx.font = '12px Arial';
        ctx.fillText('采集3个以上测点后自动生成', width / 2, height / 2 + 10);
    }
    
    // ========== 计算变换参数 ==========
    function 计算变换参数(canvasWidth, canvasHeight) {
        const padding = 60;  // 留出色标空间
        const colorbarWidth = 60;
        const availableWidth = canvasWidth - padding - colorbarWidth;
        const availableHeight = canvasHeight - padding * 2;
        
        // 获取数据边界
        let bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        
        if (实验状态?.形状配置) {
            bounds = 获取形状边界(实验状态.形状配置);
        }
        
        const dataWidth = bounds.maxX - bounds.minX;
        const dataHeight = bounds.maxY - bounds.minY;
        
        const scaleX = availableWidth / dataWidth;
        const scaleY = availableHeight / dataHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9;
        
        const offsetX = padding + (availableWidth - dataWidth * scale) / 2 - bounds.minX * scale;
        const offsetY = padding + (availableHeight - dataHeight * scale) / 2 - bounds.minY * scale;
        
        return { scale, offsetX, offsetY, bounds };
    }
    
    function 获取形状边界(config) {
        let minX = 0, maxX = 100, minY = 0, maxY = 100;
        
        switch (config.type) {
            case 'rectangle':
                maxX = config.width || 100;
                maxY = config.height || 100;
                break;
            case 'circle':
                const cx = config.centerX || 50;
                const cy = config.centerY || 50;
                const r = config.outerRadius || 50;
                minX = cx - r; maxX = cx + r;
                minY = cy - r; maxY = cy + r;
                break;
            case 'polygon':
                if (config.vertices?.length > 0) {
                    minX = Math.min(...config.vertices.map(v => v[0]));
                    maxX = Math.max(...config.vertices.map(v => v[0]));
                    minY = Math.min(...config.vertices.map(v => v[1]));
                    maxY = Math.max(...config.vertices.map(v => v[1]));
                }
                break;
        }
        
        return { minX, maxX, minY, maxY };
    }
    
    // ========== 绘制云图 ==========
    function 绘制云图(transform) {
        const grid = 云图数据.grid;
        if (!grid || !grid.xi || !grid.yi || !grid.zi) return;
        
        const { scale, offsetX, offsetY } = transform;
        const vmin = 云图数据.metadata?.vmin ?? Math.min(...grid.zi.flat().filter(v => v !== null));
        const vmax = 云图数据.metadata?.vmax ?? Math.max(...grid.zi.flat().filter(v => v !== null));
        const vrange = vmax - vmin || 1;
        
        const rows = grid.zi.length;
        const cols = grid.zi[0]?.length || 0;
        
        if (rows === 0 || cols === 0) return;
        
        // 计算像素大小
        const dx = (grid.xi[0][1] - grid.xi[0][0]) * scale;
        const dy = (grid.yi[1]?.[0] - grid.yi[0][0]) * scale;
        
        // 绘制每个网格单元
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const z = grid.zi[i][j];
                if (z === null || z === undefined || isNaN(z)) continue;
                
                const x = grid.xi[i][j] * scale + offsetX;
                const y = grid.yi[i][j] * scale + offsetY;
                
                // 计算颜色
                const normalized = (z - vmin) / vrange;
                const color = 值到颜色(normalized);
                
                ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${显示设置.透明度})`;
                ctx.fillRect(x - dx/2, y - dy/2, dx + 1, dy + 1);
            }
        }
    }
    
    // ========== 值到颜色映射 ==========
    function 值到颜色(normalized) {
        const colormap = 色图[显示设置.色图名称] || 色图.jet;
        const n = colormap.length - 1;
        const idx = Math.max(0, Math.min(n, normalized * n));
        const i = Math.floor(idx);
        const t = idx - i;
        
        if (i >= n) {
            return colormap[n].map(c => Math.round(c * 255));
        }
        
        const c1 = colormap[i];
        const c2 = colormap[i + 1];
        
        return [
            Math.round((c1[0] + t * (c2[0] - c1[0])) * 255),
            Math.round((c1[1] + t * (c2[1] - c1[1])) * 255),
            Math.round((c1[2] + t * (c2[2] - c1[2])) * 255)
        ];
    }
    
    // ========== 绘制测点 ==========
    function 绘制测点(transform) {
        const points = 云图数据.points || 实验状态?.已测点列表?.map(id => {
            return 实验状态.测点列表.find(p => p.id === id);
        }).filter(Boolean);
        
        if (!points || points.length === 0) return;
        
        const { scale, offsetX, offsetY } = transform;
        
        points.forEach(point => {
            if (!point) return;
            
            const x = point.x * scale + offsetX;
            const y = point.y * scale + offsetY;
            
            // 绘制测点标记
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }
    
    // ========== 绘制色标 ==========
    function 绘制色标(width, height) {
        const barWidth = 20;
        const barHeight = height - 100;
        const barX = width - 50;
        const barY = 50;
        
        // 获取值范围
        const vmin = 云图数据?.metadata?.vmin ?? 0;
        const vmax = 云图数据?.metadata?.vmax ?? 100;
        
        // 绘制色标条
        const gradient = ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
        const colormap = 色图[显示设置.色图名称] || 色图.jet;
        colormap.forEach((c, i) => {
            gradient.addColorStop(i / (colormap.length - 1), `rgb(${c[0]*255}, ${c[1]*255}, ${c[2]*255})`);
        });
        
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 绘制边框
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // 绘制刻度
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            const y = barY + barHeight - (i / tickCount) * barHeight;
            const value = vmin + (i / tickCount) * (vmax - vmin);
            
            ctx.beginPath();
            ctx.moveTo(barX + barWidth, y);
            ctx.lineTo(barX + barWidth + 5, y);
            ctx.stroke();
            
            ctx.fillText(value.toFixed(0), barX + barWidth + 8, y + 3);
        }
        
        // 绘制单位
        ctx.save();
        ctx.translate(barX + barWidth + 35, barY + barHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('应力 (MPa)', 0, 0);
        ctx.restore();
    }
    
    // ========== 绘制置信度标签 ==========
    function 绘制置信度标签(width, height) {
        const confidence = 云图数据?.metadata?.confidence || 'low';
        const method = 云图数据?.method || '--';
        
        const confidenceText = {
            'none': '无插值',
            'low': '低置信度',
            'medium': '中置信度',
            'high': '高置信度'
        };
        
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`插值: ${method} | ${confidenceText[confidence] || confidence}`, 10, height - 10);
    }
    
    // ========== 交互处理 ==========
    function 处理鼠标移动(event) {
        if (!云图数据?.grid) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const value = 获取位置应力值(x, y);
        if (value !== null) {
            显示提示(event.clientX, event.clientY, value);
        } else {
            隐藏提示();
        }
    }
    
    function 获取位置应力值(screenX, screenY) {
        if (!云图数据?.grid) return null;
        
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        const transform = 计算变换参数(width, height);
        const { scale, offsetX, offsetY } = transform;
        
        // 转换为数据坐标
        const dataX = (screenX - offsetX) / scale;
        const dataY = (screenY - offsetY) / scale;
        
        // 在网格中查找最近的值
        const grid = 云图数据.grid;
        const rows = grid.zi.length;
        const cols = grid.zi[0]?.length || 0;
        
        if (rows === 0 || cols === 0) return null;
        
        // 简单的最近邻查找
        let minDist = Infinity;
        let value = null;
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const gx = grid.xi[i][j];
                const gy = grid.yi[i][j];
                const dist = Math.sqrt((dataX - gx) ** 2 + (dataY - gy) ** 2);
                
                if (dist < minDist && grid.zi[i][j] !== null) {
                    minDist = dist;
                    value = grid.zi[i][j];
                }
            }
        }
        
        // 如果距离太远，返回null
        if (minDist > 10) return null;
        
        return value;
    }
    
    function 处理点击(event) {
        // 可以添加点击测点的交互
    }
    
    function 显示提示(x, y, value) {
        let tooltip = document.getElementById('field-contour-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'field-contour-tooltip';
            tooltip.className = 'canvas-tooltip';
            document.body.appendChild(tooltip);
        }
        
        tooltip.innerHTML = `应力: ${value.toFixed(1)} MPa`;
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y + 15) + 'px';
        tooltip.style.display = 'block';
    }
    
    function 隐藏提示() {
        const tooltip = document.getElementById('field-contour-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
    
    // ========== 高亮测点 ==========
    function 高亮测点(pointId) {
        // 可以添加测点高亮效果
        刷新();
    }
    
    // ========== 清空 ==========
    function 清空() {
        云图数据 = null;
        if (canvas && ctx) {
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);
            绘制空状态(width, height);
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
        更新数据,
        刷新,
        高亮测点,
        清空,
        导出云图图片
    };
})();
