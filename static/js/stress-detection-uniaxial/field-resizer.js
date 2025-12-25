// ==================== 面板拖拽和折叠模块 ====================
// 功能：上下区域拖拽调节、左右区域拖拽调节、预览/云图折叠

const FieldResizer = (function() {
    'use strict';
    
    // ========== 状态 ==========
    let 状态 = {
        上下比例: 50,  // 上半区占比 (30-70)
        预览折叠: false,
        云图折叠: false,
        正在拖拽: false
    };
    
    // DOM 元素
    let elements = {};
    
    // 回调
    let callbacks = {};
    
    // ResizeObserver 实例
    let resizeObservers = [];
    
    // 折叠动画状态（防止动画期间频繁刷新导致跳动）
    let 正在折叠动画 = false;
    
    // ========== 初始化 ==========
    function 初始化(cbs) {
        callbacks = cbs || {};
        
        // 获取元素
        elements = {
            displayArea: document.querySelector('.field-display-area'),
            topSection: document.querySelector('.field-top-section'),
            bottomSection: document.querySelector('.field-bottom-section'),
            verticalHandle: document.getElementById('field-resize-vertical'),
            previewContainer: document.getElementById('field-preview-container'),
            contourContainer: document.getElementById('field-contour-container'),
            previewHeader: document.querySelector('#field-preview-container .field-collapsible-header'),
            contourHeader: document.querySelector('#field-contour-container .field-collapsible-header')
        };
        
        // 绑定事件
        绑定拖拽事件();
        绑定折叠事件();
        绑定尺寸监听();
        
        // 应用初始比例
        应用比例();

    }
    
    // ========== 拖拽事件 ==========
    function 绑定拖拽事件() {
        // 垂直拖拽（上下）
        if (elements.verticalHandle) {
            elements.verticalHandle.addEventListener('mousedown', (e) => {
                开始拖拽(e);
            });
        }
        
        // 全局鼠标事件
        document.addEventListener('mousemove', 处理拖拽);
        document.addEventListener('mouseup', 结束拖拽);
    }
    
    function 开始拖拽(e) {
        e.preventDefault();
        状态.正在拖拽 = true;
        
        // 添加激活样式
        if (elements.verticalHandle) {
            elements.verticalHandle.classList.add('active');
        }
        
        // 禁止选择文本
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
    }
    
    function 处理拖拽(e) {
        if (!状态.正在拖拽 || !elements.displayArea) return;
        
        const rect = elements.displayArea.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;
        
        // 计算比例 (30-70)
        let ratio = (y / height) * 100;
        ratio = Math.max(30, Math.min(70, ratio));
        
        状态.上下比例 = ratio;
        应用比例();
    }
    
    function 结束拖拽() {
        if (!状态.正在拖拽) return;
        
        状态.正在拖拽 = false;
        
        // 移除激活样式
        elements.verticalHandle?.classList.remove('active');
        
        // 恢复选择
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // 通知画布调整尺寸
        callbacks.刷新画布?.();
    }
    
    // ========== 折叠事件 ==========
    function 绑定折叠事件() {
        if (elements.previewHeader) {
            elements.previewHeader.addEventListener('click', () => 切换折叠('preview'));
        }
        
        if (elements.contourHeader) {
            elements.contourHeader.addEventListener('click', () => 切换折叠('contour'));
        }
    }
    
    // ========== 尺寸监听 ==========
    function 绑定尺寸监听() {
        // 使用 ResizeObserver 监听容器尺寸变化，实时调整 Canvas
        if (typeof ResizeObserver !== 'undefined') {
            // 监听预览容器
            if (elements.previewContainer) {
                const previewObserver = new ResizeObserver(() => {
                    // 使用 requestAnimationFrame 优化性能
                    requestAnimationFrame(() => {
                        callbacks.刷新画布?.();
                    });
                });
                previewObserver.observe(elements.previewContainer);
                resizeObservers.push(previewObserver);
            }
            
            // 监听云图容器
            if (elements.contourContainer) {
                const contourObserver = new ResizeObserver(() => {
                    requestAnimationFrame(() => {
                        callbacks.刷新画布?.();
                    });
                });
                contourObserver.observe(elements.contourContainer);
                resizeObservers.push(contourObserver);
            }

        } else {
            console.warn('[面板调节] 浏览器不支持 ResizeObserver，使用延迟刷新');
        }
    }
    
    function 切换折叠(target) {
        if (target === 'preview') {
            // 检查是否可以折叠（云图不能同时折叠）
            if (!状态.预览折叠 && 状态.云图折叠) {
                // 不能同时折叠，先展开云图
                状态.云图折叠 = false;
            }
            状态.预览折叠 = !状态.预览折叠;
        } else if (target === 'contour') {
            // 检查是否可以折叠（预览不能同时折叠）
            if (!状态.云图折叠 && 状态.预览折叠) {
                // 不能同时折叠，先展开预览
                状态.预览折叠 = false;
            }
            状态.云图折叠 = !状态.云图折叠;
        }
        
        应用折叠状态();
        
        // ResizeObserver 会自动触发刷新，不需要延迟调用
        // 但为了兼容不支持 ResizeObserver 的浏览器，保留延迟刷新
        if (resizeObservers.length === 0) {
            setTimeout(() => {
                callbacks.刷新画布?.();
            }, 350);
        }
    }
    
    function 应用折叠状态() {
        const GAP = 10; // 两个面板之间的间距（与CSS中的gap保持一致）
        const COLLAPSED_WIDTH = 40; // 折叠后的宽度
        
        if (elements.previewContainer) {
            elements.previewContainer.classList.toggle('collapsed', 状态.预览折叠);
        }
        if (elements.contourContainer) {
            elements.contourContainer.classList.toggle('collapsed', 状态.云图折叠);
        }
        
        // 使用 width 而不是 flex 来实现平滑过渡
        if (状态.预览折叠 && !状态.云图折叠) {
            // 预览折叠，云图扩展
            if (elements.previewContainer) {
                elements.previewContainer.style.width = `${COLLAPSED_WIDTH}px`;
            }
            if (elements.contourContainer) {
                elements.contourContainer.style.width = `calc(100% - ${COLLAPSED_WIDTH}px - ${GAP}px)`;
            }
        } else if (状态.云图折叠 && !状态.预览折叠) {
            // 云图折叠，预览扩展
            if (elements.previewContainer) {
                elements.previewContainer.style.width = `calc(100% - ${COLLAPSED_WIDTH}px - ${GAP}px)`;
            }
            if (elements.contourContainer) {
                elements.contourContainer.style.width = `${COLLAPSED_WIDTH}px`;
            }
        } else {
            // 都展开，各占50%
            if (elements.previewContainer) {
                elements.previewContainer.style.width = `calc(50% - ${GAP / 2}px)`;
            }
            if (elements.contourContainer) {
                elements.contourContainer.style.width = `calc(50% - ${GAP / 2}px)`;
            }
        }
    }
    
    // ========== 应用比例 ==========
    function 应用比例() {
        // 上下比例 - 使用 flex-grow 比例而不是固定百分比
        if (elements.topSection && elements.bottomSection) {
            elements.topSection.style.flex = `${状态.上下比例} 0 0`;
            elements.bottomSection.style.flex = `${100 - 状态.上下比例} 0 0`;
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        获取状态: () => ({ ...状态 }),
        销毁: () => {
            // 清理 ResizeObserver
            resizeObservers.forEach(observer => observer.disconnect());
            resizeObservers = [];
        }
    };
})();
