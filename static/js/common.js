// ==================== 通用工具函数模块 ====================
// 使用立即执行函数封装，避免全局污染

const CommonUtils = (function() {
    'use strict';
    
    // 格式化采样率
    function 格式化采样率(采样率) {
        if (采样率 >= 1e9) {
            return (采样率 / 1e9).toFixed(2) + ' GSa/s';
        } else if (采样率 >= 1e6) {
            return (采样率 / 1e6).toFixed(2) + ' MSa/s';
        } else if (采样率 >= 1e3) {
            return (采样率 / 1e3).toFixed(2) + ' kSa/s';
        } else {
            return 采样率.toFixed(2) + ' Sa/s';
        }
    }
    
    // 格式化时基
    function 格式化时基(时基) {
        if (时基 >= 1) {
            return 时基.toFixed(0) + ' s/div';
        } else if (时基 >= 1e-3) {
            return (时基 * 1e3).toFixed(0) + ' ms/div';
        } else if (时基 >= 1e-6) {
            return (时基 * 1e6).toFixed(0) + ' μs/div';
        } else {
            return (时基 * 1e9).toFixed(0) + ' ns/div';
        }
    }
    
    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    // 通用绘图函数
    function 绘制波形到画布(targetCanvas, targetCtx, 波形数据, 波形显示状态) {
        const container = targetCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // 清空画布 - 黑色背景（示波器风格）
        targetCtx.fillStyle = '#0a0a0a';
        targetCtx.fillRect(0, 0, width, height);
        
        if (波形数据.时间.length === 0) {
            return;
        }
        
        // 减小padding以充分利用空间
        const padding = { top: 10, right: 50, bottom: 24, left: 8 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const 示波器垂直档位 = 波形数据.垂直档位 || 1;
        const 示波器垂直偏移 = 波形数据.垂直偏移 || 0;
        const 时基档位 = 波形数据.时基档位 || 1e-6;
        
        const timeOffset = 波形显示状态?.timeOffset || 0;
        const voltageOffset = 波形显示状态?.voltageOffset || 0;
        const 显示垂直档位 = 波形显示状态?.显示垂直档位 || 示波器垂直档位;
        
        // 使用显示垂直档位计算电压范围（8格 = 4个档位上 + 4个档位下）
        const 基础电压范围 = 4 * 显示垂直档位;
        const 电压最大值 = 基础电压范围 - 示波器垂直偏移 + voltageOffset;
        const 电压最小值 = -基础电压范围 - 示波器垂直偏移 + voltageOffset;
        
        const 时间最大值 = 5 * 时基档位 + timeOffset;
        const 时间最小值 = -5 * 时基档位 + timeOffset;
        
        const 时间数据 = 波形数据.时间;
        const 电压数据 = 波形数据.电压;
        
        // 绘制网格
        绘制网格(targetCtx, padding, chartWidth, chartHeight);
        
        // 绘制刻度
        绘制Y轴刻度(targetCtx, padding, chartWidth, chartHeight, 电压最大值, 电压最小值, 示波器垂直偏移, voltageOffset, 显示垂直档位);
        绘制X轴刻度(targetCtx, padding, chartWidth, chartHeight, 时基档位, timeOffset, 波形数据.时间单位);
        
        // 绘制波形
        绘制波形线(targetCtx, padding, chartWidth, chartHeight, 时间数据, 电压数据, 时间最小值, 时间最大值, 电压最小值, 电压最大值, 示波器垂直偏移);
    }
    
    // 绘制网格
    function 绘制网格(ctx, padding, chartWidth, chartHeight) {
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 10; i++) {
            const x = padding.left + (chartWidth / 10) * i;
            if (i === 5) {
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }
        
        for (let i = 0; i <= 8; i++) {
            const y = padding.top + (chartHeight / 8) * i;
            if (i === 4) {
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
    }
    
    // 绘制Y轴刻度
    function 绘制Y轴刻度(ctx, padding, chartWidth, chartHeight, 电压最大值, 电压最小值, 示波器垂直偏移, voltageOffset, 显示垂直档位) {
        ctx.fillStyle = '#999999';
        ctx.font = '12px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= 8; i++) {
            // 隐藏最上(i=0)和最下(i=8)的标签
            if (i === 0 || i === 8) continue;
            
            const y = padding.top + (chartHeight / 8) * i;
            const value = 电压最大值 - (电压最大值 - 电压最小值) * (i / 8);
            
            const 实际零点 = 示波器垂直偏移 + voltageOffset;
            if (Math.abs(value - 实际零点) < 0.01 * 显示垂直档位) {
                ctx.font = 'bold 13px Consolas, monospace';
                ctx.fillStyle = '#eab308';
                ctx.fillText('0V', padding.left + chartWidth + 8, y);
                ctx.font = '12px Consolas, monospace';
                ctx.fillStyle = '#999999';
            } else {
                let 显示文本;
                if (Math.abs(value) >= 1) {
                    // V单位 - 智能显示小数点
                    显示文本 = value.toFixed(2).replace(/\.?0+$/, '') + 'V';
                } else if (Math.abs(value) >= 0.001) {
                    // mV单位 - 智能显示小数点
                    显示文本 = (value * 1000).toFixed(2).replace(/\.?0+$/, '') + 'mV';
                } else {
                    // μV单位 - 智能显示小数点
                    显示文本 = (value * 1e6).toFixed(2).replace(/\.?0+$/, '') + 'μV';
                }
                ctx.fillText(显示文本, padding.left + chartWidth + 8, y);
            }
        }
    }
    
    // 绘制X轴刻度
    function 绘制X轴刻度(ctx, padding, chartWidth, chartHeight, 时基档位, timeOffset, 时间单位) {
        ctx.fillStyle = '#999999';
        ctx.font = '11px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // 根据画布宽度决定刻度密度
        const 稀疏模式 = chartWidth < 400;
        
        // 绘制刻度 - 每个刻度独立判断单位
        for (let i = 0; i <= 10; i++) {
            // 隐藏最左(i=0)和最右(i=10)的标签
            if (i === 0 || i === 10) continue;
            
            // 稀疏模式：只显示奇数刻度（1,3,5,7,9）
            if (稀疏模式 && i % 2 === 0) continue;
            
            const x = padding.left + (chartWidth / 10) * i;
            const 格数 = i - 5;
            const 时间值_秒 = 格数 * 时基档位 + timeOffset;
            const 绝对值_秒 = Math.abs(时间值_秒);
            
            let 显示文本;
            
            // 0点位置特殊处理 - 只显示"0s"
            if (i === 5 && Math.abs(timeOffset) < 0.01 * 时基档位) {
                显示文本 = '0s';
                ctx.font = 'bold 12px Consolas, monospace';
                ctx.fillStyle = '#eab308';
            } else {
                // 根据每个刻度值的大小独立选择单位
                let 显示单位, 显示值, 格式化值;
                
                // 999ns及以下显示ns
                if (绝对值_秒 <= 999e-9) {
                    显示单位 = 'ns';
                    显示值 = 时间值_秒 * 1e9;
                    格式化值 = Math.round(显示值).toString();
                }
                // 999ns以上到999μs显示μs
                else if (绝对值_秒 <= 999e-6) {
                    显示单位 = 'μs';
                    显示值 = 时间值_秒 * 1e6;
                    格式化值 = 显示值.toFixed(1).replace(/\.0$/, '');
                }
                // 999μs以上到999ms显示ms
                else if (绝对值_秒 <= 999e-3) {
                    显示单位 = 'ms';
                    显示值 = 时间值_秒 * 1e3;
                    格式化值 = 显示值.toFixed(1).replace(/\.0$/, '');
                }
                // 999ms以上显示s
                else {
                    显示单位 = 's';
                    显示值 = 时间值_秒;
                    格式化值 = 显示值.toFixed(1).replace(/\.0$/, '');
                }
                
                显示文本 = 格式化值 + 显示单位;
                ctx.font = '11px Consolas, monospace';
                ctx.fillStyle = '#999999';
            }
            
            ctx.fillText(显示文本, x, padding.top + chartHeight + 6);
            
            // 重置样式
            if (i === 5) {
                ctx.font = '11px Consolas, monospace';
                ctx.fillStyle = '#999999';
            }
        }
        
        // 不再显示底部的"时间 (单位)"标签
    }
    
    // 绘制波形线
    function 绘制波形线(ctx, padding, chartWidth, chartHeight, 时间数据, 电压数据, 时间最小值, 时间最大值, 电压最小值, 电压最大值, 示波器垂直偏移) {
        ctx.strokeStyle = '#00ff00';  // 绿色波形（示波器风格）
        ctx.lineWidth = 2;
        
        // 设置裁剪区域，确保波形不会超出坐标区域
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
        ctx.clip();
        
        ctx.beginPath();
        
        const 最大显示点数 = 10000;
        let 抽样步长 = 1;
        let 范围内点数 = 0;
        
        for (let i = 0; i < 时间数据.length; i++) {
            if (时间数据[i] >= 时间最小值 && 时间数据[i] <= 时间最大值) {
                范围内点数++;
            }
        }
        
        if (范围内点数 > 最大显示点数) {
            抽样步长 = Math.ceil(范围内点数 / 最大显示点数);
        }
        
        let 已开始 = false;
        let 计数 = 0;
        
        for (let i = 0; i < 时间数据.length; i++) {
            const t = 时间数据[i];
            const v = 电压数据[i];
            
            if (t < 时间最小值 || t > 时间最大值) continue;
            if (计数 % 抽样步长 !== 0) {
                计数++;
                continue;
            }
            计数++;
            
            // 直接使用电压值，不进行缩放
            const x = padding.left + ((t - 时间最小值) / (时间最大值 - 时间最小值)) * chartWidth;
            const y = padding.top + chartHeight - ((v - 电压最小值) / (电压最大值 - 电压最小值)) * chartHeight;
            
            if (!已开始) {
                ctx.moveTo(x, y);
                已开始 = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.restore();  // 恢复裁剪区域
    }
    
    // 绘制单个波形（简化版）
    function 绘制单个波形(ctx, 波形, width, height, color, alpha) {
        const padding = { top: 20, right: 50, bottom: 40, left: 40 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const 时间 = 波形.time;
        const 电压 = 波形.voltage;
        
        if (时间.length === 0) return;
        
        let 时间最小 = 时间[0], 时间最大 = 时间[0];
        let 电压最小 = 电压[0], 电压最大 = 电压[0];
        
        for (let i = 0; i < 时间.length; i++) {
            if (时间[i] < 时间最小) 时间最小 = 时间[i];
            if (时间[i] > 时间最大) 时间最大 = 时间[i];
            if (电压[i] < 电压最小) 电压最小 = 电压[i];
            if (电压[i] > 电压最大) 电压最大 = 电压[i];
        }
        
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        for (let i = 0; i < 时间.length; i++) {
            const x = padding.left + ((时间[i] - 时间最小) / (时间最大 - 时间最小)) * chartWidth;
            const y = padding.top + chartHeight - ((电压[i] - 电压最小) / (电压最大 - 电压最小)) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    
    // ========== 自定义Prompt对话框 ==========
    let promptResolve = null;
    
    function customPrompt(message, defaultValue = '', title = '输入') {
        return new Promise((resolve) => {
            promptResolve = resolve;
            
            const modal = document.getElementById('customPromptModal');
            const titleEl = document.getElementById('customPromptTitle');
            const messageEl = document.getElementById('customPromptMessage');
            const input = document.getElementById('customPromptInput');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            input.value = defaultValue;
            
            modal.style.display = 'flex';
            input.focus();
            input.select();
            
            // 支持回车键确认
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    window.confirmCustomPrompt();
                } else if (e.key === 'Escape') {
                    window.closeCustomPrompt();
                }
            };
        });
    }
    
    // 暴露公共接口
    return {
        格式化采样率,
        格式化时基,
        formatFileSize,
        绘制波形到画布,
        绘制单个波形,
        customPrompt
    };
})();

// ========== 全局函数（供HTML onclick使用）==========
window.confirmCustomPrompt = function() {
    const modal = document.getElementById('customPromptModal');
    const input = document.getElementById('customPromptInput');
    const value = input.value.trim();
    
    modal.style.display = 'none';
    
    if (window.promptResolveFunc) {
        window.promptResolveFunc(value || null);
        window.promptResolveFunc = null;
    }
};

window.closeCustomPrompt = function() {
    const modal = document.getElementById('customPromptModal');
    modal.style.display = 'none';
    
    if (window.promptResolveFunc) {
        window.promptResolveFunc(null);
        window.promptResolveFunc = null;
    }
};

// 修改customPrompt使用全局变量
CommonUtils.customPrompt = function(message, defaultValue = '', title = '输入') {
    return new Promise((resolve) => {
        window.promptResolveFunc = resolve;
        
        const modal = document.getElementById('customPromptModal');
        const titleEl = document.getElementById('customPromptTitle');
        const messageEl = document.getElementById('customPromptMessage');
        const input = document.getElementById('customPromptInput');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        input.value = defaultValue;
        
        modal.style.display = 'flex';
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // 支持回车键确认
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                window.confirmCustomPrompt();
            } else if (e.key === 'Escape') {
                window.closeCustomPrompt();
            }
        };
    });
};

// ========== 自定义Confirm对话框（完全参照customPrompt模式）==========
window.confirmCustomConfirm = function() {
    const modal = document.getElementById('customConfirmModal');
    modal.style.display = 'none';
    
    if (window.confirmResolveFunc) {
        window.confirmResolveFunc(true);
        window.confirmResolveFunc = null;
    }
};

window.closeCustomConfirm = function() {
    const modal = document.getElementById('customConfirmModal');
    modal.style.display = 'none';
    
    if (window.confirmResolveFunc) {
        window.confirmResolveFunc(false);
        window.confirmResolveFunc = null;
    }
};

CommonUtils.customConfirm = function(message, title = '确认') {
    return new Promise((resolve) => {
        window.confirmResolveFunc = resolve;
        
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('customConfirmTitle');
        const messageEl = document.getElementById('customConfirmMessage');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        modal.style.display = 'flex';
    });
};

// ========== 弹窗拖拽功能 ==========
CommonUtils.makeModalDraggable = function(modalContent, dragHandle) {
    // modalContent: 弹窗内容元素（要移动的元素）
    // dragHandle: 拖拽手柄元素（通常是标题栏）
    
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let initialized = false;
    
    // 设置拖拽手柄样式
    dragHandle.style.cursor = 'move';
    dragHandle.style.userSelect = 'none';
    
    dragHandle.addEventListener('mousedown', function(e) {
        // 忽略关闭按钮等子元素的点击
        if (e.target.classList.contains('close-btn') || 
            e.target.classList.contains('modal-close') ||
            e.target.tagName === 'BUTTON') {
            return;
        }
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // 获取当前位置
        const rect = modalContent.getBoundingClientRect();
        
        // 首次拖拽时，将弹窗从flex布局改为fixed定位
        if (!initialized) {
            modalContent.style.position = 'fixed';
            modalContent.style.left = rect.left + 'px';
            modalContent.style.top = rect.top + 'px';
            modalContent.style.margin = '0';
            initialized = true;
        }
        
        initialLeft = parseFloat(modalContent.style.left) || rect.left;
        initialTop = parseFloat(modalContent.style.top) || rect.top;
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;
        
        // 限制在窗口范围内
        const rect = modalContent.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;
        
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        
        modalContent.style.left = newLeft + 'px';
        modalContent.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
};

// 自动为新添加的弹窗启用拖拽
CommonUtils.enableModalDrag = function(modalContent) {
    // 查找标题栏作为拖拽手柄
    const header = modalContent.querySelector('.modal-header');
    if (header) {
        CommonUtils.makeModalDraggable(modalContent, header);
    }
};

// 使用MutationObserver自动监听新弹窗
(function() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {  // Element node
                    // 检查是否是弹窗遮罩层（匹配各种弹窗类名）
                    if (node.classList && (
                        node.classList.contains('modal') ||
                        node.classList.contains('field-spacing-modal')
                    )) {
                        // 找到弹窗内容
                        const content = node.querySelector('.modal-content, .field-modal');
                        if (content) {
                            CommonUtils.enableModalDrag(content);
                        }
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();

// ========== 表格自动滚动工具 ==========
CommonUtils.scrollToTableRow = function(row, options = {}) {
    /**
     * 表格行自动滚动
     * @param {HTMLElement} row - 要滚动到的行元素
     * @param {Object} options - 配置选项
     * @param {string} options.behavior - 滚动行为 ('smooth' | 'auto')，默认 'smooth'
     * @param {string} options.block - 垂直对齐 ('start' | 'center' | 'end' | 'nearest')，默认 'center'
     * @param {number} options.delay - 延迟时间（毫秒），默认 50
     */
    if (!row) return;
    
    const behavior = options.behavior || 'smooth';
    const block = options.block || 'center';
    const delay = options.delay !== undefined ? options.delay : 50;
    
    setTimeout(() => {
        row.scrollIntoView({ behavior, block });
    }, delay);
};
