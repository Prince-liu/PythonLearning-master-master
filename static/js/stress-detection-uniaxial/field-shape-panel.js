// ==================== 形状定义面板模块 ====================
// 功能：形状类型选择、参数输入、布尔运算、验证

const FieldShapePanel = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let elements = null;
    let callbacks = null;
    
    // 当前形状类型
    let 当前形状类型 = 'rectangle';  // 'rectangle' | 'circle' | 'polygon'
    
    // 布尔运算列表（孔洞/缺口）
    let 布尔运算列表 = [];
    
    // ========== 初始化 ==========
    function 初始化(state, els, cbs) {
        实验状态 = state;
        elements = els;
        callbacks = cbs;
        
        绑定事件();

    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 形状类型切换
        document.querySelectorAll('input[name="field-shape-type"]').forEach(radio => {
            radio.addEventListener('change', function() {
                切换形状类型(this.value);
            });
        });
        
        // 🆕 移除实时预览：参数输入变化时不再自动预览
        // document.querySelectorAll('.field-shape-param').forEach(input => {
        //     input.addEventListener('change', 实时预览);
        //     input.addEventListener('input', debounce(实时预览, 300));
        // });
        
        // 添加孔洞按钮
        const addHoleBtn = document.getElementById('field-shape-add-hole');
        if (addHoleBtn) {
            addHoleBtn.addEventListener('click', 打开添加孔洞对话框);
        }
        
        // 验证形状按钮
        const validateBtn = document.getElementById('field-shape-validate');
        if (validateBtn) {
            validateBtn.addEventListener('click', 验证形状);
        }
        
        // 应用形状按钮
        const applyBtn = document.getElementById('field-shape-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', 应用形状);
        }
    }
    
    // ========== 切换形状类型 ==========
    function 切换形状类型(type) {
        当前形状类型 = type;
        
        // 隐藏所有参数面板
        document.querySelectorAll('.field-shape-params').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // 显示选中类型的参数面板
        const panel = document.getElementById(`field-shape-${type}-params`);
        if (panel) {
            panel.style.display = 'block';
        }
        
        // 清空布尔运算
        布尔运算列表 = [];
        刷新布尔运算列表();
        
        // 🆕 移除自动预览：切换形状类型时不再自动预览
        // 实时预览();
    }
    
    // ========== 获取形状配置 ==========
    function 获取形状配置() {
        const config = { type: 当前形状类型 };
        
        switch (当前形状类型) {
            case 'rectangle':
                config.width = parseFloat(document.getElementById('field-shape-rect-width')?.value) || 100;
                config.height = parseFloat(document.getElementById('field-shape-rect-height')?.value) || 100;
                break;
                
            case 'circle':
                config.centerX = parseFloat(document.getElementById('field-shape-circle-cx')?.value) || 50;
                config.centerY = parseFloat(document.getElementById('field-shape-circle-cy')?.value) || 50;
                config.outerRadius = parseFloat(document.getElementById('field-shape-circle-radius')?.value) || 50;
                config.innerRadius = parseFloat(document.getElementById('field-shape-circle-inner')?.value) || 0;
                config.startAngle = parseFloat(document.getElementById('field-shape-circle-start')?.value) || 0;
                config.endAngle = parseFloat(document.getElementById('field-shape-circle-end')?.value) || 360;
                break;
                
            case 'polygon':
                const verticesText = document.getElementById('field-shape-polygon-vertices')?.value || '';
                config.vertices = 解析顶点列表(verticesText);
                break;
        }
        
        // 添加布尔运算
        if (布尔运算列表.length > 0) {
            config.modifiers = 布尔运算列表;
        }
        
        return config;
    }
    
    // ========== 解析顶点列表 ==========
    function 解析顶点列表(text) {
        const vertices = [];
        
        if (!text || typeof text !== 'string') {
            return vertices;
        }
        
        const lines = text.trim().split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过空行
            if (!line) continue;
            
            // 分割坐标（支持中英文逗号、空格、制表符）
            const parts = line.split(/[,，\s\t]+/).filter(p => p.length > 0);
            
            if (parts.length >= 2) {
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                
                if (!isNaN(x) && !isNaN(y)) {
                    vertices.push([x, y]);
                }
            }
        }
        
        return vertices;
    }
    
    // ========== 实时预览 ==========
    function 实时预览() {
        const config = 获取形状配置();
        // 临时更新状态以便预览
        实验状态.形状配置 = config;
        callbacks?.刷新预览画布?.();
    }
    
    // ========== 验证形状 ==========
    async function 验证形状() {
        const config = 获取形状配置();
        
        try {
            const result = await pywebview.api.validate_shape(config);
            
            if (result.success && result.is_valid) {
                callbacks?.显示状态信息('✅', '形状验证通过', 
                    `面积: ${result.area != null ? Number(result.area).toFixed(2) : '--'} mm²`, 'success');
                
                // 显示警告（如果有）
                if (result.warnings && result.warnings.length > 0) {
                    console.warn('[形状面板] 警告:', result.warnings);
                }
            } else {
                const errorMsg = result.error || result.message || '形状无效';
                callbacks?.显示状态信息('❌', '形状验证失败', errorMsg, 'error');
            }
        } catch (error) {
            console.error('[形状面板] 验证失败:', error);
            callbacks?.显示状态信息('❌', '验证失败', error.toString(), 'error');
        }
    }
    
    // ========== 应用形状 ==========
    async function 应用形状() {
        // 🆕 验证：必须先加载标定数据
        if (!实验状态.工作流程.已加载标定) {
            callbacks?.显示状态信息('⚠️', '请先加载标定数据', '必须先完成标定数据加载才能应用形状', 'warning');
            return;
        }
        
        const config = 获取形状配置();
        
        // 调试：在界面上显示配置
        
        // 先验证
        try {
            const result = await pywebview.api.validate_shape(config);

            if (!result.success || !result.is_valid) {
                const errorMsg = result.error || '形状无效，无法应用';
                // 显示详细错误信息
                const detailMsg = `配置: ${JSON.stringify(config)}\n验证结果: ${JSON.stringify(result)}`;
                callbacks?.显示状态信息('❌', errorMsg, detailMsg, 'error');
                // 同时用alert显示，确保能看到
                alert(`形状验证失败\n\n${errorMsg}\n\n顶点数: ${config.vertices?.length || 0}\n顶点: ${JSON.stringify(config.vertices)}`);
                return;
            }
            
            // 更新状态
            实验状态.形状配置 = config;
            实验状态.工作流程.已应用形状 = true;  // 🆕 标记已完成
            callbacks?.更新形状配置(config);
            
            // 刷新预览画布
            callbacks?.刷新预览画布?.();
            
            callbacks?.显示状态信息('✅', '形状已应用', '', 'success');
            
            // 更新状态徽章
            const statusBadge = document.getElementById('field-shape-status');
            if (statusBadge) {
                statusBadge.textContent = '✅ 已设置';
                statusBadge.className = 'status-badge success';
            }
            
        } catch (error) {
            console.error('[形状面板] 应用形状失败:', error);
            callbacks?.显示状态信息('❌', '应用失败', error.toString(), 'error');
            alert(`应用形状失败\n\n${error.toString()}`);
        }
    }
    
    // ========== 布尔运算管理 ==========
    function 打开添加孔洞对话框() {
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-hole-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-sm">
                <div class="modal-header">
                    <h3>🔘 添加孔洞</h3>
                    <button class="modal-close" onclick="document.getElementById('field-hole-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section">
                        <div class="form-section-title">
                            <span class="section-icon">📐</span>
                            <span>孔洞参数</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>孔洞形状</label>
                                <select id="field-hole-shape" class="form-input">
                                    <option value="circle">圆形</option>
                                    <option value="rectangle">矩形</option>
                                </select>
                            </div>
                            <div id="field-hole-circle-params">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>圆心X (mm)</label>
                                        <input type="number" id="field-hole-cx" class="form-input" value="50">
                                    </div>
                                    <div class="form-group">
                                        <label>圆心Y (mm)</label>
                                        <input type="number" id="field-hole-cy" class="form-input" value="50">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>半径 (mm)</label>
                                    <input type="number" id="field-hole-radius" class="form-input" value="10" min="0.1">
                                </div>
                            </div>
                            <div id="field-hole-rect-params" style="display:none;">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>左下角X (mm)</label>
                                        <input type="number" id="field-hole-rx" class="form-input" value="40">
                                    </div>
                                    <div class="form-group">
                                        <label>左下角Y (mm)</label>
                                        <input type="number" id="field-hole-ry" class="form-input" value="40">
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>宽度 (mm)</label>
                                        <input type="number" id="field-hole-rw" class="form-input" value="20">
                                    </div>
                                    <div class="form-group">
                                        <label>高度 (mm)</label>
                                        <input type="number" id="field-hole-rh" class="form-input" value="20">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('field-hole-modal').remove()">取消</button>
                    <button class="btn btn-primary" onclick="FieldShapePanel.添加孔洞()">添加</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 切换孔洞形状参数
        document.getElementById('field-hole-shape')?.addEventListener('change', function() {
            document.getElementById('field-hole-circle-params').style.display = this.value === 'circle' ? 'block' : 'none';
            document.getElementById('field-hole-rect-params').style.display = this.value === 'rectangle' ? 'block' : 'none';
        });
    }
    
    function 添加孔洞() {
        const shape = document.getElementById('field-hole-shape')?.value || 'circle';
        
        let hole = { op: 'subtract', shape: shape };
        
        if (shape === 'circle') {
            const cx = parseFloat(document.getElementById('field-hole-cx')?.value);
            const cy = parseFloat(document.getElementById('field-hole-cy')?.value);
            const r = parseFloat(document.getElementById('field-hole-radius')?.value);
            hole.centerX = isNaN(cx) ? 50 : cx;
            hole.centerY = isNaN(cy) ? 50 : cy;
            hole.radius = isNaN(r) ? 10 : r;
        } else {
            const x = parseFloat(document.getElementById('field-hole-rx')?.value);
            const y = parseFloat(document.getElementById('field-hole-ry')?.value);
            const w = parseFloat(document.getElementById('field-hole-rw')?.value);
            const h = parseFloat(document.getElementById('field-hole-rh')?.value);
            hole.x = isNaN(x) ? 40 : x;
            hole.y = isNaN(y) ? 40 : y;
            hole.width = isNaN(w) ? 20 : w;
            hole.height = isNaN(h) ? 20 : h;
        }
        
        布尔运算列表.push(hole);
        刷新布尔运算列表();
        
        document.getElementById('field-hole-modal')?.remove();
        
        // 更新状态并刷新预览
        const config = 获取形状配置();
        实验状态.形状配置 = config;
        callbacks?.刷新预览画布?.();
        
        callbacks?.显示状态信息('✅', '孔洞已添加', '', 'success');
    }
    
    function 删除孔洞(index) {
        布尔运算列表.splice(index, 1);
        刷新布尔运算列表();
        
        // 更新状态并刷新预览
        const config = 获取形状配置();
        实验状态.形状配置 = config;
        callbacks?.刷新预览画布?.();
    }
    
    function 刷新布尔运算列表() {
        const container = document.getElementById('field-shape-modifiers');
        if (!container) return;
        
        if (布尔运算列表.length === 0) {
            container.innerHTML = '<div class="empty">无孔洞/缺口</div>';
            return;
        }
        
        container.innerHTML = 布尔运算列表.map((mod, index) => {
            let desc = '';
            if (mod.shape === 'circle') {
                desc = `圆形孔洞 (${mod.centerX}, ${mod.centerY}) R=${mod.radius}`;
            } else {
                desc = `矩形孔洞 (${mod.x}, ${mod.y}) ${mod.width}×${mod.height}`;
            }
            return `
                <div class="modifier-item">
                    <span>${desc}</span>
                    <button class="btn btn-sm btn-danger" onclick="FieldShapePanel.删除孔洞(${index})">×</button>
                </div>
            `;
        }).join('');
    }
    
    // ========== 更新显示 ==========
    function 更新显示(config) {
        if (!config) {
            清空();
            return;
        }
        
        当前形状类型 = config.type || 'rectangle';
        
        // 选中对应的单选按钮
        const radio = document.querySelector(`input[name="field-shape-type"][value="${当前形状类型}"]`);
        if (radio) radio.checked = true;
        
        切换形状类型(当前形状类型);
        
        // 填充参数
        switch (当前形状类型) {
            case 'rectangle':
                if (document.getElementById('field-shape-rect-width')) 
                    document.getElementById('field-shape-rect-width').value = config.width || 100;
                if (document.getElementById('field-shape-rect-height')) 
                    document.getElementById('field-shape-rect-height').value = config.height || 100;
                break;
            case 'circle':
                // ... 填充圆形参数
                break;
            case 'polygon':
                // ... 填充多边形参数
                break;
        }
        
        // 加载布尔运算
        布尔运算列表 = config.modifiers || [];
        刷新布尔运算列表();
    }
    
    function 清空() {
        当前形状类型 = 'rectangle';
        布尔运算列表 = [];
        刷新布尔运算列表();
        
        // 🆕 重置形状参数输入框（使用正确的ID）
        // 矩形参数
        const rectWidthInput = document.getElementById('field-shape-rect-width');
        const rectHeightInput = document.getElementById('field-shape-rect-height');
        if (rectWidthInput) rectWidthInput.value = '100';
        if (rectHeightInput) rectHeightInput.value = '100';
        
        // 圆形参数
        const circleCxInput = document.getElementById('field-shape-circle-cx');
        const circleCyInput = document.getElementById('field-shape-circle-cy');
        const circleRadiusInput = document.getElementById('field-shape-circle-radius');
        const circleInnerInput = document.getElementById('field-shape-circle-inner');
        const circleStartInput = document.getElementById('field-shape-circle-start');
        const circleEndInput = document.getElementById('field-shape-circle-end');
        if (circleCxInput) circleCxInput.value = '50';
        if (circleCyInput) circleCyInput.value = '50';
        if (circleRadiusInput) circleRadiusInput.value = '50';
        if (circleInnerInput) circleInnerInput.value = '0';
        if (circleStartInput) circleStartInput.value = '0';
        if (circleEndInput) circleEndInput.value = '360';
        
        // 多边形参数
        const polygonVerticesInput = document.getElementById('field-shape-polygon-vertices');
        if (polygonVerticesInput) polygonVerticesInput.value = '';
        
        // 重置形状类型单选按钮
        const rectRadio = document.querySelector('input[name="field-shape-type"][value="rectangle"]');
        if (rectRadio) rectRadio.checked = true;
        
        // 显示矩形参数面板，隐藏其他
        document.querySelectorAll('.field-shape-params').forEach(panel => {
            panel.style.display = 'none';
        });
        const rectParams = document.getElementById('field-shape-rect-params');
        if (rectParams) rectParams.style.display = 'block';
        
        const statusBadge = document.getElementById('field-shape-status');
        if (statusBadge) {
            statusBadge.textContent = '⚪ 未设置';
            statusBadge.className = 'status-badge';
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
        切换形状类型,
        获取形状配置,
        验证形状,
        应用形状,
        添加孔洞,
        删除孔洞,
        更新显示,
        清空
    };
})();
