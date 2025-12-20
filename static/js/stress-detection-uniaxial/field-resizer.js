// ==================== 面板拖拽和折叠模块 ====================
// 功能：上下区域拖拽调节、左右区域拖拽调节、预览/云图折叠

const FieldResizer = (function() {
    'use strict';
    
    // ========== 状态 ==========
    let 状态 = {
        上下比例: 50,  // 上半区占比 (30-70)
        左右比例: 50,  // 预览占比 (0-100, 0=折叠预览, 100=折叠云图)
        预览折叠: false,
        云图折叠: false,
        正在拖拽: false,
        拖拽类型: null  // 'vertical' | 'horizontal'
    };
    
    // DOM 元素
    let elements = {};
    
    // 回调
    let callbacks = {};
    
    // ========== 初始化 ==========
    function 初始化(cbs) {
        callbacks = cbs || {};
        
        // 获取元素
        elements = {
            displayArea: document.querySelector('.field-display-area'),
            topSection: document.querySelector('.field-top-section'),
            bottomSection: document.querySelector('.field-bottom-section'),
            verticalHandle: document.getElementById('field-resize-vertical'),
            horizontalHandle: document.getElementById('field-resize-horizontal'),
            previewContainer: document.getElementById('field-preview-container'),
            contourContainer: document.getElementById('field-contour-container'),
            previewHeader: document.querySelector('#field-preview-container .field-collapsible-header'),
            contourHeader: document.querySelector('#field-contour-container .field-collapsible-header')
        };
        
        // 绑定事件
        绑定拖拽事件();
        绑定折叠事件();
        
        // 应用初始比例
        应用比例();
        
        console.log('[面板调节] 模块初始化完成');
    }
    
    // ========== 拖拽事件 ==========
    function 绑定拖拽事件() {
        // 垂直拖拽（上下）
        if (elements.verticalHandle) {
            elements.verticalHandle.addEventListener('mousedown', (e) => {
                开始拖拽(e, 'vertical');
            });
        }
        
        // 水平拖拽（左右）
        if (elements.horizontalHandle) {
            elements.horizontalHandle.addEventListener('mousedown', (e) => {
                开始拖拽(e, 'horizontal');
            });
        }
        
        // 全局鼠标事件
        document.addEventListener('mousemove', 处理拖拽);
        document.addEventListener('mouseup', 结束拖拽);
    }
    
    function 开始拖拽(e, type) {
        e.preventDefault();
        状态.正在拖拽 = true;
        状态.拖拽类型 = type;
        
        // 添加激活样式
        if (type === 'vertical' && elements.verticalHandle) {
            elements.verticalHandle.classList.add('active');
        } else if (type === 'horizontal' && elements.horizontalHandle) {
            elements.horizontalHandle.classList.add('active');
        }
        
        // 禁止选择文本
        document.body.style.userSelect = 'none';
        document.body.style.cursor = type === 'vertical' ? 'ns-resize' : 'ew-resize';
    }
    
    function 处理拖拽(e) {
        if (!状态.正在拖拽) return;
        
        if (状态.拖拽类型 === 'vertical') {
            处理垂直拖拽(e);
        } else if (状态.拖拽类型 === 'horizontal') {
            处理水平拖拽(e);
        }
    }
    
    function 处理垂直拖拽(e) {
        if (!elements.displayArea) return;
        
        const rect = elements.displayArea.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;
        
        // 计算比例 (30-70)
        let ratio = (y / height) * 100;
        ratio = Math.max(30, Math.min(70, ratio));
        
        状态.上下比例 = ratio;
        应用比例();
    }
    
    function 处理水平拖拽(e) {
        if (!elements.bottomSection || 状态.预览折叠 || 状态.云图折叠) return;
        
        const rect = elements.bottomSection.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        // 计算比例 (20-80)
        let ratio = (x / width) * 100;
        ratio = Math.max(20, Math.min(80, ratio));
        
        状态.左右比例 = ratio;
        应用比例();
    }
    
    function 结束拖拽() {
        if (!状态.正在拖拽) return;
        
        状态.正在拖拽 = false;
        
        // 移除激活样式
        elements.verticalHandle?.classList.remove('active');
        elements.horizontalHandle?.classList.remove('active');
        
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
        
        // 延迟刷新画布
        setTimeout(() => {
            callbacks.刷新画布?.();
        }, 350);
    }
    
    function 应用折叠状态() {
        if (elements.previewContainer) {
            elements.previewContainer.classList.toggle('collapsed', 状态.预览折叠);
        }
        if (elements.contourContainer) {
            elements.contourContainer.classList.toggle('collapsed', 状态.云图折叠);
        }
        
        // 隐藏/显示水平拖拽条
        if (elements.horizontalHandle) {
            elements.horizontalHandle.style.display = 
                (状态.预览折叠 || 状态.云图折叠) ? 'none' : 'block';
        }
        
        // 调整展开面板的 flex 以占据剩余空间
        if (状态.预览折叠 && !状态.云图折叠) {
            // 预览折叠，云图扩展
            if (elements.contourContainer) {
                elements.contourContainer.style.flex = '1';
            }
        } else if (状态.云图折叠 && !状态.预览折叠) {
            // 云图折叠，预览扩展
            if (elements.previewContainer) {
                elements.previewContainer.style.flex = '1';
            }
        } else {
            // 都展开，恢复原比例
            应用比例();
        }
    }
    
    // ========== 应用比例 ==========
    function 应用比例() {
        // 上下比例 - 使用 flex-grow 比例而不是固定百分比
        if (elements.topSection && elements.bottomSection) {
            elements.topSection.style.flex = `${状态.上下比例} 0 0`;
            elements.bottomSection.style.flex = `${100 - 状态.上下比例} 0 0`;
        }
        
        // 左右比例（仅当都展开时）
        if (!状态.预览折叠 && !状态.云图折叠) {
            if (elements.previewContainer) {
                elements.previewContainer.style.flex = `${状态.左右比例} 0 0`;
            }
            if (elements.contourContainer) {
                elements.contourContainer.style.flex = `${100 - 状态.左右比例} 0 0`;
            }
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        获取状态: () => ({ ...状态 })
    };
})();
