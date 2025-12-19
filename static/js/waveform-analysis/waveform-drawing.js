// ==================== 波形绘制模块 ====================
// 负责所有波形绘制相关功能

const WaveformDrawing = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let canvas, ctx;
    
    // ========== 初始化函数 ==========
    function 初始化(canvasElement, ctxElement) {
        canvas = canvasElement;
        ctx = ctxElement;
    }
    
    // ========== 主绘制函数 ==========
    function 绘制波形(波形数据, 配置 = {}) {
        if (!波形数据 || !波形数据.time || !波形数据.voltage) {
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // 白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        if (波形数据.time.length === 0) return;
        
        const padding = { top: 30, right: 80, bottom: 60, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const 时间 = 波形数据.time;
        const 电压 = 波形数据.voltage;
        
        // 使用缩放范围或原始范围
        let 时间最小, 时间最大, 电压最小, 电压最大;
        if (配置.缩放范围) {
            时间最小 = 配置.缩放范围.时间最小;
            时间最大 = 配置.缩放范围.时间最大;
            电压最小 = 配置.缩放范围.电压最小;
            电压最大 = 配置.缩放范围.电压最大;
        } else {
            时间最小 = Math.min(...时间);
            时间最大 = Math.max(...时间);
            
            // 计算电压范围,使0V居中
            const 原始电压最小 = Math.min(...电压);
            const 原始电压最大 = Math.max(...电压);
            const 最大绝对值 = Math.max(Math.abs(原始电压最小), Math.abs(原始电压最大));
            电压最小 = -最大绝对值;
            电压最大 = 最大绝对值;
        }
        const 时间范围 = 时间最大 - 时间最小;
        
        // 智能选择时间单位（如果配置中强制指定单位，则使用指定单位）
        let 时间单位, 时间缩放;
        if (配置.强制时间单位) {
            时间单位 = 配置.强制时间单位;
            if (时间单位 === 'μs' || 时间单位 === 'us') {
                时间缩放 = 1e6;
            } else if (时间单位 === 'ms') {
                时间缩放 = 1e3;
            } else if (时间单位 === 'ns') {
                时间缩放 = 1e9;
            } else {
                时间缩放 = 1;
            }
        } else {
            // 自动选择单位
            if (时间范围 < 1e-6) {
                时间单位 = 'ns';
                时间缩放 = 1e9;
            } else if (时间范围 < 1e-3) {
                时间单位 = 'μs';
                时间缩放 = 1e6;
            } else if (时间范围 < 1) {
                时间单位 = 'ms';
                时间缩放 = 1e3;
            } else {
                时间单位 = 's';
                时间缩放 = 1;
            }
        }
        
        // 使用自定义标签或默认标签
        const X轴标签 = 配置.X轴标签 || `时间 (${时间单位})`;
        const Y轴标签 = 配置.Y轴标签 || '电压 (V)';
        
        // 绘制网格和坐标轴
        绘制网格(padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, 时间缩放);
        绘制坐标轴刻度(padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, 时间单位, 时间缩放, X轴标签, Y轴标签);
        
        // 设置裁剪区域
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
        ctx.clip();
        
        // 检查是否为多曲线模式
        if (配置.多曲线模式 && 配置.曲线列表) {
            // 绘制多条曲线
            const colors = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#f59e0b', '#ec4899'];
            配置.曲线列表.forEach((曲线, index) => {
                const color = colors[index % colors.length];
                绘制波形线(曲线.time, 曲线.voltage, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, color);
            });
        } else {
            // 绘制单条波形线（蓝色）
            绘制波形线(时间, 电压, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大);
        }
        
        ctx.restore();
        
        // 绘制包络线（如果有）
        if (配置.包络数据 && 配置.显示包络) {
            绘制包络线(时间, 配置.包络数据, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, 配置.Hilbert配置);
        }
        
        // 绘制峰值标记（如果有）
        if (配置.选中的峰值 && 配置.选中的峰值.length > 0) {
            绘制峰值标记(配置.选中的峰值, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大);
        }
        
        // 绘制选择框（如果有）
        if (配置.框选起点 && 配置.框选终点) {
            绘制选择框(配置.框选起点, 配置.框选终点);
        }
        
        // 绘制图例（如果是多曲线模式）
        if (配置.多曲线模式 && 配置.曲线列表) {
            绘制图例(配置.曲线列表, padding, width, height, 配置.参考信号名称);
        }
    }
    
    // ========== 网格绘制 ==========
    function 绘制网格(padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, 时间缩放) {
        // 计算X轴刻度值
        const 时间范围显示 = (时间最大 - 时间最小) * 时间缩放;
        const 起始值显示 = 时间最小 * 时间缩放;
        const 结束值显示 = 时间最大 * 时间缩放;
        
        // 计算合适的刻度间隔
        const 粗略间隔 = 时间范围显示 / 8;
        const 数量级 = Math.pow(10, Math.floor(Math.log10(粗略间隔)));
        const 归一化间隔 = 粗略间隔 / 数量级;
        let 刻度间隔;
        if (归一化间隔 <= 1) {
            刻度间隔 = 数量级;
        } else if (归一化间隔 <= 2) {
            刻度间隔 = 2 * 数量级;
        } else if (归一化间隔 <= 5) {
            刻度间隔 = 5 * 数量级;
        } else {
            刻度间隔 = 10 * 数量级;
        }
        
        // 计算刻度值数组
        const 刻度起始 = Math.floor(起始值显示 / 刻度间隔) * 刻度间隔;
        const 刻度结束 = Math.ceil(结束值显示 / 刻度间隔) * 刻度间隔;
        const 刻度值数组 = [];
        for (let 刻度值 = 刻度起始; 刻度值 <= 刻度结束; 刻度值 += 刻度间隔) {
            刻度值数组.push(刻度值);
        }
        
        // 绘制垂直网格线
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        
        刻度值数组.forEach((刻度值, index) => {
            const 时间值原始 = 刻度值 / 时间缩放;
            if (时间值原始 < 时间最小 || 时间值原始 > 时间最大) return;
            
            const x = padding.left + ((时间值原始 - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            
            // 中间的网格线加粗
            const 中间索引 = Math.floor(刻度值数组.length / 2);
            if (index === 中间索引) {
                ctx.strokeStyle = '#9ca3af';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 1;
            }
            
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        });
        
        // 绘制水平网格线
        for (let i = 0; i <= 8; i++) {
            const y = padding.top + (chartHeight / 8) * i;
            if (i === 4) {
                ctx.strokeStyle = '#9ca3af';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
    }
    
    // ========== 坐标轴刻度绘制 ==========
    function 绘制坐标轴刻度(padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, 时间单位, 时间缩放, X轴标签, Y轴标签) {
        // Y轴刻度
        ctx.fillStyle = '#374151';
        ctx.font = '13px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // 计算Y轴合适的小数位数
        const 电压范围 = Math.abs(电压最大 - 电压最小);
        let Y轴小数位数 = 2;
        if (电压范围 < 0.01) {
            Y轴小数位数 = 5;
        } else if (电压范围 < 0.1) {
            Y轴小数位数 = 4;
        } else if (电压范围 < 1) {
            Y轴小数位数 = 3;
        }
        
        for (let i = 0; i <= 8; i++) {
            const y = padding.top + (chartHeight / 8) * i;
            const value = 电压最大 - (电压最大 - 电压最小) * (i / 8);
            
            // 根据Y轴标签判断是否为互相关系数
            if (Y轴标签 && Y轴标签.includes('互相关')) {
                // 互相关系数，根据范围动态调整精度
                if (电压范围 < 0.1) {
                    ctx.fillText(value.toFixed(3), padding.left + chartWidth + 10, y);
                } else if (电压范围 < 1) {
                    ctx.fillText(value.toFixed(2), padding.left + chartWidth + 10, y);
                } else {
                    ctx.fillText(value.toFixed(1), padding.left + chartWidth + 10, y);
                }
            } else {
                // 电压值显示 - 自适应小数位数和单位
                let 显示文本;
                const 绝对值 = Math.abs(value);
                
                // 特殊处理0值，始终显示为"0V"
                if (绝对值 < 1e-10) {
                    显示文本 = '0V';
                } else if (绝对值 >= 1) {
                    // >= 1V，显示V
                    // 自适应小数位数：去除尾部的0
                    const 数值 = value.toFixed(Y轴小数位数);
                    显示文本 = parseFloat(数值) + 'V';
                } else if (绝对值 >= 0.001) {
                    // >= 1mV，显示mV
                    const 数值 = (value * 1000).toFixed(Y轴小数位数);
                    显示文本 = parseFloat(数值) + 'mV';
                } else {
                    // < 1mV，显示μV
                    const 数值 = (value * 1e6).toFixed(Y轴小数位数);
                    显示文本 = parseFloat(数值) + 'μV';
                }
                
                ctx.fillText(显示文本, padding.left + chartWidth + 10, y);
            }
        }
        
        // X轴刻度
        const 时间范围显示 = (时间最大 - 时间最小) * 时间缩放;
        const 起始值显示 = 时间最小 * 时间缩放;
        const 结束值显示 = 时间最大 * 时间缩放;
        
        const 粗略间隔 = 时间范围显示 / 8;
        const 数量级 = Math.pow(10, Math.floor(Math.log10(粗略间隔)));
        const 归一化间隔 = 粗略间隔 / 数量级;
        let 刻度间隔;
        if (归一化间隔 <= 1) {
            刻度间隔 = 数量级;
        } else if (归一化间隔 <= 2) {
            刻度间隔 = 2 * 数量级;
        } else if (归一化间隔 <= 5) {
            刻度间隔 = 5 * 数量级;
        } else {
            刻度间隔 = 10 * 数量级;
        }
        
        const 刻度起始 = Math.floor(起始值显示 / 刻度间隔) * 刻度间隔;
        const 刻度结束 = Math.ceil(结束值显示 / 刻度间隔) * 刻度间隔;
        const 刻度值数组 = [];
        for (let 刻度值 = 刻度起始; 刻度值 <= 刻度结束; 刻度值 += 刻度间隔) {
            刻度值数组.push(刻度值);
        }
        
        // 计算X轴合适的小数位数
        let X轴小数位数 = 0;
        if (刻度间隔 < 0.01) {
            X轴小数位数 = 3;
        } else if (刻度间隔 < 0.1) {
            X轴小数位数 = 2;
        } else if (刻度间隔 < 1) {
            X轴小数位数 = 1;
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        刻度值数组.forEach(刻度值 => {
            const 时间值原始 = 刻度值 / 时间缩放;
            if (时间值原始 < 时间最小 || 时间值原始 > 时间最大) return;
            
            const x = padding.left + ((时间值原始 - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            
            // 智能单位显示：根据数值大小选择合适的单位
            let 显示文本;
            const 原始秒值 = 时间值原始;
            const 纳秒值 = 原始秒值 * 1e9;
            const 微秒值 = 原始秒值 * 1e6;
            const 毫秒值 = 原始秒值 * 1e3;
            
            // 特殊处理0值，始终显示为"0s"
            if (Math.abs(原始秒值) < 1e-15) {
                显示文本 = '0s';
            } else if (Math.abs(纳秒值) <= 999) {
                // ≤999ns，显示ns
                显示文本 = parseFloat(纳秒值.toFixed(2)) + 'ns';
            } else if (Math.abs(微秒值) < 1000) {
                // <1000μs，显示μs
                显示文本 = parseFloat(微秒值.toFixed(3)) + 'μs';
            } else if (Math.abs(毫秒值) < 1000) {
                // <1000ms，显示ms
                显示文本 = parseFloat(毫秒值.toFixed(3)) + 'ms';
            } else {
                // ≥1s，显示s
                显示文本 = parseFloat(原始秒值.toFixed(3)) + 's';
            }
            
            ctx.fillText(显示文本, x, padding.top + chartHeight + 10);
        });
        
        // 坐标轴标签（不再显示单位，因为已经在刻度上显示）
        // 如果有自定义X轴标签且不包含单位括号，则显示
        if (X轴标签 && !X轴标签.includes('(')) {
            ctx.font = 'bold 13px Microsoft YaHei';
            ctx.fillStyle = '#666';
            ctx.fillText(X轴标签, padding.left + chartWidth / 2, padding.top + chartHeight + 40);
        }
        
        ctx.save();
        ctx.translate(15, padding.top + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(Y轴标签 || '电压 (V)', 0, 0);
        ctx.restore();
    }
    
    // ========== 波形线绘制 ==========
    function 绘制波形线(时间, 电压, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, 颜色 = '#2563eb') {
        ctx.strokeStyle = 颜色;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        let 已开始 = false;
        for (let i = 0; i < 时间.length; i++) {
            const x = padding.left + ((时间[i] - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const y = padding.top + chartHeight - ((电压[i] - 电压最小) / (电压最大 - 电压最小)) * chartHeight;
            
            if (!已开始) {
                ctx.moveTo(x, y);
                已开始 = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
    }
    
    // ========== 包络线绘制 ==========
    function 绘制包络线(时间, 包络数据, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大, Hilbert配置) {
        if (!包络数据 || 包络数据.length !== 时间.length) return;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
        ctx.clip();
        
        ctx.strokeStyle = Hilbert配置.color;
        ctx.lineWidth = Hilbert配置.lineWidth;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        let 已开始 = false;
        for (let i = 0; i < 时间.length; i++) {
            const x = padding.left + ((时间[i] - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const y = padding.top + chartHeight - ((包络数据[i] - 电压最小) / (电压最大 - 电压最小)) * chartHeight;
            
            if (!已开始) {
                ctx.moveTo(x, y);
                已开始 = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    
    // ========== 峰值标记绘制 ==========
    function 绘制峰值标记(选中的峰值, padding, chartWidth, chartHeight, 时间最小, 时间最大, 电压最小, 电压最大) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
        ctx.clip();
        
        // 绘制起始点
        if (选中的峰值.length >= 1) {
            const peak = 选中的峰值[0];
            const x = padding.left + ((peak.time - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const y = padding.top + chartHeight - ((peak.voltage - 电压最小) / (电压最大 - 电压最小)) * chartHeight;
            
            // 垂直虚线
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 红色圆点
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // 绘制第二个峰值
        if (选中的峰值.length === 2) {
            const peak1 = 选中的峰值[0];
            const peak2 = 选中的峰值[1];
            
            const x1 = padding.left + ((peak1.time - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const y1 = padding.top + chartHeight - ((peak1.voltage - 电压最小) / (电压最大 - 电压最小)) * chartHeight;
            const x2 = padding.left + ((peak2.time - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const y2 = padding.top + chartHeight - ((peak2.voltage - 电压最小) / (电压最大 - 电压最小)) * chartHeight;
            
            // 垂直虚线
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x2, padding.top);
            ctx.lineTo(x2, padding.top + chartHeight);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 红色圆点
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(x2, y2, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            // 坐标标签
            ctx.fillStyle = '#3b82f6';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const 时间值 = (peak2.time * 1e6).toFixed(3);
            const 电压值 = peak2.voltage.toFixed(4);
            const 标签文本 = `(${时间值}, ${电压值})`;
            const 文本宽度 = ctx.measureText(标签文本).width;
            
            const 气泡X = x2;
            const 气泡Y = y2 - 30;
            const 气泡宽度 = 文本宽度 + 20;
            const 气泡高度 = 24;
            
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.roundRect(气泡X - 气泡宽度/2, 气泡Y - 气泡高度/2, 气泡宽度, 气泡高度, 4);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.fillText(标签文本, 气泡X, 气泡Y);
        }
        
        ctx.restore();
        
        // 绘制双向箭头和时间差标注（在图表内部顶部）
        if (选中的峰值.length === 2) {
            const peak1 = 选中的峰值[0];
            const peak2 = 选中的峰值[1];
            
            const x1 = padding.left + ((peak1.time - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const x2 = padding.left + ((peak2.time - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            
            // 箭头位置改为图表内部顶部
            const 箭头Y = padding.top + 50;
            
            // 水平线
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, 箭头Y);
            ctx.lineTo(x2, 箭头Y);
            ctx.stroke();
            
            // 箭头
            const 箭头大小 = 8;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(x1, 箭头Y);
            ctx.lineTo(x1 + 箭头大小, 箭头Y - 箭头大小/2);
            ctx.lineTo(x1 + 箭头大小, 箭头Y + 箭头大小/2);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(x2, 箭头Y);
            ctx.lineTo(x2 - 箭头大小, 箭头Y - 箭头大小/2);
            ctx.lineTo(x2 - 箭头大小, 箭头Y + 箭头大小/2);
            ctx.closePath();
            ctx.fill();
            
            // 时间差标注 - 在箭头上方
            const 时间差 = Math.abs(peak2.time - peak1.time);
            const 时间差文本 = `Δt = ${(时间差 * 1e6).toFixed(4)} μs`;
            
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const 标注宽度 = ctx.measureText(时间差文本).width;
            
            const 标注X = (x1 + x2) / 2;
            const 标注Y = 箭头Y - 25;
            const 框宽度 = 标注宽度 + 24;
            const 框高度 = 32;
            
            // 白色背景框，带阴影
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
            
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(标注X - 框宽度/2, 标注Y - 框高度/2, 框宽度, 框高度, 6);
            ctx.fill();
            ctx.stroke();
            
            // 重置阴影
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // 红色文字
            ctx.fillStyle = '#ef4444';
            ctx.fillText(时间差文本, 标注X, 标注Y);
        }
    }
    
    // ========== 选择框绘制 ==========
    function 绘制选择框(框选起点, 框选终点) {
        if (!框选起点 || !框选终点) return;
        
        const x = Math.min(框选起点.x, 框选终点.x);
        const y = Math.min(框选起点.y, 框选终点.y);
        const width = Math.abs(框选终点.x - 框选起点.x);
        const height = Math.abs(框选终点.y - 框选起点.y);
        
        // 半透明矩形
        ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
        ctx.fillRect(x, y, width, height);
        
        // 边框
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
    }
    
    // ========== 画布调整 ==========
    function 调整画布大小() {
        if (!canvas || !ctx) {
            return;
        }
        
        const container = canvas.parentElement;
        if (!container) {
            return;
        }
        
        const rect = container.getBoundingClientRect();
        
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    // ========== 图例绘制 ==========
    function 绘制图例(曲线列表, padding, width, height, 参考信号名称) {
        const colors = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#f59e0b', '#ec4899'];
        
        // 设置字体并计算图例尺寸
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let maxTextWidth = 0;
        
        // 计算参考信号标题宽度
        const 参考标题 = `${参考信号名称 || '参考信号'} (基准)`;
        ctx.font = 'bold 11px Arial';
        maxTextWidth = Math.max(maxTextWidth, ctx.measureText(参考标题).width);
        
        // 计算每条曲线的宽度
        ctx.font = '11px Arial';
        曲线列表.forEach((曲线) => {
            const time_delay_us = 曲线.time_delay_us;
            const time_delay_ns = time_delay_us * 1000;
            
            // 根据时间延迟大小选择合适的单位
            let displayText;
            if (Math.abs(time_delay_ns) <= 999) {
                displayText = `${time_delay_ns.toFixed(2)} ns`;
            } else if (Math.abs(time_delay_us) < 1000) {
                displayText = `${time_delay_us.toFixed(3)} μs`;
            } else {
                displayText = `${(time_delay_us / 1000).toFixed(3)} ms`;
            }
            
            const label = `${曲线.name} (dt=${displayText})`;
            const textWidth = ctx.measureText(label).width;
            maxTextWidth = Math.max(maxTextWidth, textWidth);
        });
        
        const lineWidth = 25;  // 线条长度
        const lineGap = 8;     // 线条与文字间距
        const padding_h = 10;  // 水平内边距
        const padding_v = 10;  // 垂直内边距
        const lineHeight = 20; // 行高
        
        const legendWidth = padding_h * 2 + lineWidth + lineGap + maxTextWidth;
        const legendHeight = padding_v * 2 + (曲线列表.length + 1) * lineHeight;
        const legendX = width - padding.right - legendWidth - 10;
        let legendY = padding.top + 10;
        
        // 绘制图例背景（带阴影）
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        ctx.shadowColor = 'transparent';
        
        // 绘制边框
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        
        let currentY = legendY + padding_v + lineHeight / 2;
        
        // 第一行：绘制参考信号（黑色线条）
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(legendX + padding_h, currentY);
        ctx.lineTo(legendX + padding_h + lineWidth, currentY);
        ctx.stroke();
        
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(参考标题, legendX + padding_h + lineWidth + lineGap, currentY);
        
        currentY += lineHeight;
        
        // 其他行：绘制对比信号
        ctx.font = '11px Arial';
        曲线列表.forEach((曲线, index) => {
            const color = colors[index % colors.length];
            
            // 绘制颜色线
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(legendX + padding_h, currentY);
            ctx.lineTo(legendX + padding_h + lineWidth, currentY);
            ctx.stroke();
            
            // 绘制文本
            ctx.fillStyle = '#374151';
            const time_delay_us = 曲线.time_delay_us;
            const time_delay_ns = time_delay_us * 1000;
            
            // 根据时间延迟大小选择合适的单位
            let displayText;
            if (Math.abs(time_delay_ns) <= 999) {
                displayText = `${time_delay_ns.toFixed(2)} ns`;
            } else if (Math.abs(time_delay_us) < 1000) {
                displayText = `${time_delay_us.toFixed(3)} μs`;
            } else {
                displayText = `${(time_delay_us / 1000).toFixed(3)} ms`;
            }
            
            const label = `${曲线.name} (dt=${displayText})`;
            ctx.fillText(label, legendX + padding_h + lineWidth + lineGap, currentY);
            
            currentY += lineHeight;
        });
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        绘制波形,
        调整画布大小,
        获取Canvas: () => canvas,
        获取Context: () => ctx
    };
})();
