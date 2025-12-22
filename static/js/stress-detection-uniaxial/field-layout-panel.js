// ==================== 布点设置面板模块 ====================
// 功能：布点方式选择、参数配置、测点生成、顺序优化

const FieldLayoutPanel = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let elements = null;
    let callbacks = null;
    
    // 当前布点类型
    let 当前布点类型 = 'grid';  // 'grid' | 'polar' | 'adaptive' | 'custom'
    
    // 边距设置
    let 边距设置 = {
        mode: 'uniform',  // 'uniform' | 'separate'
        uniform: 10,
        top: 10,
        bottom: 10,
        left: 10,
        right: 10
    };
    
    // ========== 初始化 ==========
    function 初始化(state, els, cbs) {
        实验状态 = state;
        elements = els;
        callbacks = cbs;
        
        绑定事件();
        console.log('[布点面板] 模块初始化完成');
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 布点类型切换
        document.querySelectorAll('input[name="field-layout-type"]').forEach(radio => {
            radio.addEventListener('change', function() {
                切换布点类型(this.value);
            });
        });
        
        // 边距设置按钮
        const marginBtn = document.getElementById('field-layout-margin-btn');
        if (marginBtn) {
            marginBtn.addEventListener('click', 打开边距设置弹窗);
        }
        
        // 行间距变距按钮
        const rowSpacingBtn = document.getElementById('field-layout-row-spacing-btn');
        if (rowSpacingBtn) {
            rowSpacingBtn.addEventListener('click', () => 打开间距设置弹窗('row'));
        }
        
        // 列间距变距按钮
        const colSpacingBtn = document.getElementById('field-layout-col-spacing-btn');
        if (colSpacingBtn) {
            colSpacingBtn.addEventListener('click', () => 打开间距设置弹窗('col'));
        }
        
        // 极坐标每层点数变距按钮
        const pprBtn = document.getElementById('field-layout-polar-ppr-btn');
        if (pprBtn) {
            pprBtn.addEventListener('click', 打开每层点数设置弹窗);
        }
        
        // 极坐标半径步长变距按钮
        const rstepBtn = document.getElementById('field-layout-polar-rstep-btn');
        if (rstepBtn) {
            rstepBtn.addEventListener('click', 打开半径步长设置弹窗);
        }
        
        // 生成测点按钮
        const generateBtn = document.getElementById('field-layout-generate');
        if (generateBtn) {
            generateBtn.addEventListener('click', 生成测点);
        }
        
        // 优化顺序按钮
        const optimizeBtn = document.getElementById('field-layout-optimize');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', 优化顺序);
        }
        
        // 清空测点按钮
        const clearBtn = document.getElementById('field-layout-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', 清空测点);
        }
        
        // 导入CSV按钮
        const importBtn = document.getElementById('field-layout-import');
        if (importBtn) {
            importBtn.addEventListener('click', 导入CSV);
        }
    }
    
    // ========== 打开边距设置弹窗 ==========
    function 打开边距设置弹窗() {
        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'field-margin-modal';
        modal.innerHTML = `
            <div class="field-margin-modal-content">
                <div class="field-margin-modal-header">
                    <span>边距设置</span>
                    <span class="close-btn">×</span>
                </div>
                <div class="field-margin-modal-body">
                    <div class="field-margin-mode-group">
                        <label class="field-margin-mode-option">
                            <input type="radio" name="margin-mode" value="uniform" ${边距设置.mode === 'uniform' ? 'checked' : ''}>
                            <span>统一边距</span>
                        </label>
                        <div class="field-margin-uniform-input">
                            <input type="number" id="margin-uniform-value" value="${边距设置.uniform}" min="0" step="1">
                            <span>mm</span>
                        </div>
                        
                        <label class="field-margin-mode-option">
                            <input type="radio" name="margin-mode" value="separate" ${边距设置.mode === 'separate' ? 'checked' : ''}>
                            <span>分别设置</span>
                        </label>
                        <div class="field-margin-separate-inputs ${边距设置.mode === 'separate' ? 'active' : ''}">
                            <div class="field-margin-separate-row">
                                <div class="field-margin-separate-item">
                                    <label>上边距 (mm)</label>
                                    <input type="number" id="margin-top-value" value="${边距设置.top}" min="0" step="1">
                                </div>
                                <div class="field-margin-separate-item">
                                    <label>下边距 (mm)</label>
                                    <input type="number" id="margin-bottom-value" value="${边距设置.bottom}" min="0" step="1">
                                </div>
                            </div>
                            <div class="field-margin-separate-row">
                                <div class="field-margin-separate-item">
                                    <label>左边距 (mm)</label>
                                    <input type="number" id="margin-left-value" value="${边距设置.left}" min="0" step="1">
                                </div>
                                <div class="field-margin-separate-item">
                                    <label>右边距 (mm)</label>
                                    <input type="number" id="margin-right-value" value="${边距设置.right}" min="0" step="1">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="field-margin-hint">
                        💡 边距是指测点区域到试件边缘的距离
                    </div>
                </div>
                <div class="field-margin-modal-footer">
                    <button class="btn btn-secondary cancel-btn">取消</button>
                    <button class="btn btn-primary confirm-btn">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定模式切换
        const modeRadios = modal.querySelectorAll('input[name="margin-mode"]');
        const separateInputs = modal.querySelector('.field-margin-separate-inputs');
        
        modeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'separate') {
                    separateInputs.classList.add('active');
                } else {
                    separateInputs.classList.remove('active');
                }
            });
        });
        
        // 绑定关闭按钮
        modal.querySelector('.close-btn').onclick = () => modal.remove();
        modal.querySelector('.cancel-btn').onclick = () => modal.remove();
        
        // 绑定确定按钮
        modal.querySelector('.confirm-btn').onclick = () => {
            const mode = modal.querySelector('input[name="margin-mode"]:checked').value;
            
            if (mode === 'uniform') {
                const value = parseFloat(modal.querySelector('#margin-uniform-value').value) || 10;
                边距设置.mode = 'uniform';
                边距设置.uniform = value;
                边距设置.top = value;
                边距设置.bottom = value;
                边距设置.left = value;
                边距设置.right = value;
            } else {
                边距设置.mode = 'separate';
                边距设置.top = parseFloat(modal.querySelector('#margin-top-value').value) || 10;
                边距设置.bottom = parseFloat(modal.querySelector('#margin-bottom-value').value) || 10;
                边距设置.left = parseFloat(modal.querySelector('#margin-left-value').value) || 10;
                边距设置.right = parseFloat(modal.querySelector('#margin-right-value').value) || 10;
            }
            
            // 更新隐藏字段
            更新边距隐藏字段();
            
            // 更新显示
            更新边距显示();
            
            modal.remove();
            callbacks?.显示状态信息('✅', '边距设置已更新', '', 'success');
        };
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // ========== 更新边距隐藏字段 ==========
    function 更新边距隐藏字段() {
        const topEl = document.getElementById('field-layout-grid-margin-top');
        const bottomEl = document.getElementById('field-layout-grid-margin-bottom');
        const leftEl = document.getElementById('field-layout-grid-margin-left');
        const rightEl = document.getElementById('field-layout-grid-margin-right');
        const modeEl = document.getElementById('field-layout-margin-mode');
        
        if (topEl) topEl.value = 边距设置.top;
        if (bottomEl) bottomEl.value = 边距设置.bottom;
        if (leftEl) leftEl.value = 边距设置.left;
        if (rightEl) rightEl.value = 边距设置.right;
        if (modeEl) modeEl.value = 边距设置.mode;
    }
    
    // ========== 更新边距显示 ==========
    function 更新边距显示() {
        const display = document.getElementById('field-layout-margin-display');
        if (!display) return;
        
        if (边距设置.mode === 'uniform') {
            display.textContent = `统一: ${边距设置.uniform}`;
        } else {
            // 分别设置模式
            // 检查是否四边相同
            if (边距设置.top === 边距设置.bottom && 
                边距设置.left === 边距设置.right && 
                边距设置.top === 边距设置.left) {
                display.textContent = `${边距设置.top} (四边)`;
            } else {
                display.textContent = `上${边距设置.top} 下${边距设置.bottom} 左${边距设置.left} 右${边距设置.right}`;
            }
        }
    }
    
    // ========== 打开间距设置弹窗 ==========
    function 打开间距设置弹窗(type) {
        // type: 'row' 或 'col'
        const isRow = type === 'row';
        const title = isRow ? '行间距设置' : '列间距设置';
        
        // 获取当前行数或列数
        const count = isRow 
            ? parseInt(document.getElementById('field-layout-grid-rows')?.value) || 5
            : parseInt(document.getElementById('field-layout-grid-cols')?.value) || 5;
        
        if (count < 2) {
            alert(`${isRow ? '行' : '列'}数至少为2才能设置间距`);
            return;
        }
        
        const spacingCount = count - 1; // 间距数量 = 行数/列数 - 1
        
        // 获取当前间距设置
        const modeInput = document.getElementById(`field-layout-${type}-spacing-mode`);
        const valueInput = document.getElementById(`field-layout-${type}-spacing-value`);
        const arrayInput = document.getElementById(`field-layout-${type}-spacing-array`);
        
        const currentMode = modeInput?.value || 'uniform';
        const currentValue = parseFloat(valueInput?.value) || 10;
        const currentArray = arrayInput?.value ? arrayInput.value.split(',').map(v => parseFloat(v)) : [];
        
        // 计算等距时的默认间距值
        let 默认等距值 = 10;
        const 形状配置 = 实验状态.形状配置;
        if (形状配置) {
            let 可用长度 = 0;
            if (形状配置.type === 'rectangle') {
                可用长度 = isRow ? 形状配置.height : 形状配置.width;
            } else if (形状配置.type === 'circle') {
                可用长度 = 形状配置.outerRadius * 2;
            }
            
            // 减去边距
            if (可用长度 > 0) {
                if (isRow) {
                    可用长度 -= (边距设置.top + 边距设置.bottom);
                } else {
                    可用长度 -= (边距设置.left + 边距设置.right);
                }
                
                // 计算等距值：可用空间 ÷ 间距数量
                if (可用长度 > 0 && spacingCount > 0) {
                    默认等距值 = 可用长度 / spacingCount;
                }
            }
        }
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'field-spacing-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        
        // 生成间距输入框HTML（使用等距值作为默认值）
        let spacingInputsHTML = '';
        for (let i = 0; i < spacingCount; i++) {
            const value = currentMode === 'variable' && currentArray[i] !== undefined 
                ? currentArray[i] 
                : 默认等距值;
            spacingInputsHTML += `
                <div class="spacing-input-row" style="margin-bottom:8px;">
                    <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">第${i+1}-${i+2}${isRow ? '行' : '列'}间距 (mm)</label>
                    <input type="number" class="form-input spacing-value-input" data-index="${i}" value="${value.toFixed(2)}" min="0.1" step="0.1">
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div class="modal-content field-modal" style="max-width:400px;">
                <div class="modal-header">
                    <span>${title}</span>
                    <span class="close-btn" style="cursor:pointer;font-size:24px;">×</span>
                </div>
                <div class="spacing-modal-status-bar" style="display:none;padding:10px 15px;margin:10px 15px 0;border-radius:4px;font-size:13px;align-items:center;gap:8px;">
                    <span class="spacing-modal-status-icon"></span>
                    <div style="flex:1;">
                        <div class="spacing-modal-status-text" style="font-weight:500;"></div>
                        <div class="spacing-modal-status-detail" style="font-size:12px;margin-top:2px;opacity:0.9;"></div>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="spacing-mode-group">
                        <label style="display:flex;align-items:center;margin-bottom:15px;">
                            <input type="radio" name="spacing-mode" value="uniform" ${currentMode === 'uniform' ? 'checked' : ''} style="margin-right:8px;">
                            <span>等距 (自动计算: ${默认等距值.toFixed(2)} mm)</span>
                        </label>
                        
                        <label style="display:flex;align-items:center;margin-bottom:10px;">
                            <input type="radio" name="spacing-mode" value="variable" ${currentMode === 'variable' ? 'checked' : ''} style="margin-right:8px;">
                            <span>变距 (共${spacingCount}个间距)</span>
                        </label>
                        <div class="spacing-variable-inputs" style="margin-left:24px;max-height:300px;overflow-y:auto;${currentMode === 'variable' ? '' : 'display:none;'}">
                            ${spacingInputsHTML}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary close-modal-btn">取消</button>
                    <button class="btn btn-secondary restore-uniform-btn">恢复等距</button>
                    <button class="btn btn-primary confirm-spacing-btn">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 切换模式时显示/隐藏变距输入区域
        const modeRadios = modal.querySelectorAll('input[name="spacing-mode"]');
        const variableInputs = modal.querySelector('.spacing-variable-inputs');
        
        modeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'uniform') {
                    variableInputs.style.display = 'none';
                } else {
                    variableInputs.style.display = 'block';
                }
            });
        });
        
        // 关闭按钮
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());
        
        // 恢复等距按钮
        modal.querySelector('.restore-uniform-btn').addEventListener('click', () => {
            modal.querySelector('input[name="spacing-mode"][value="uniform"]').checked = true;
            modal.querySelector('input[name="spacing-mode"][value="uniform"]').dispatchEvent(new Event('change'));
        });
        
        // 确定按钮
        modal.querySelector('.confirm-spacing-btn').addEventListener('click', () => {
            const selectedMode = modal.querySelector('input[name="spacing-mode"]:checked').value;
            
            // 获取状态栏元素
            const statusBar = modal.querySelector('.spacing-modal-status-bar');
            const statusIcon = modal.querySelector('.spacing-modal-status-icon');
            const statusText = modal.querySelector('.spacing-modal-status-text');
            const statusDetail = modal.querySelector('.spacing-modal-status-detail');
            
            // 显示状态信息的辅助函数
            const showModalStatus = (icon, text, detail, type, duration = 3000) => {
                statusIcon.textContent = icon;
                statusText.textContent = text;
                statusDetail.textContent = detail;
                statusDetail.style.display = detail ? 'block' : 'none';
                
                // 设置样式
                statusBar.style.display = 'flex';
                
                // 根据类型设置背景色
                const colors = {
                    'error': '#fee',
                    'warning': '#ffc',
                    'success': '#efe',
                    'info': '#eef'
                };
                statusBar.style.backgroundColor = colors[type] || colors.info;
                
                // 自动隐藏
                if (duration > 0) {
                    setTimeout(() => {
                        statusBar.style.display = 'none';
                    }, duration);
                }
            };
            
            if (selectedMode === 'uniform') {
                // 等距模式：不需要保存具体值，后端会自动计算
                modeInput.value = 'uniform';
                valueInput.value = '';
                arrayInput.value = '';
                更新间距显示(type, 'uniform', 默认等距值, []);
                modal.remove();
                callbacks?.显示状态信息('✅', `${title}已更新为等距`, '', 'success');
            } else {
                // 变距模式：验证间距总和
                const values = [];
                modal.querySelectorAll('.spacing-value-input').forEach(input => {
                    values.push(parseFloat(input.value) || 10);
                });
                
                // 计算可用空间
                const 形状配置 = 实验状态.形状配置;
                if (形状配置) {
                    // 获取形状尺寸
                    let 可用长度 = 0;
                    if (形状配置.type === 'rectangle') {
                        可用长度 = isRow ? 形状配置.height : 形状配置.width;
                    } else if (形状配置.type === 'circle') {
                        可用长度 = 形状配置.outerRadius * 2;
                    } else {
                        // 多边形等其他形状，暂不验证
                        可用长度 = Infinity;
                    }
                    
                    // 减去边距
                    if (isRow) {
                        可用长度 -= (边距设置.top + 边距设置.bottom);
                    } else {
                        可用长度 -= (边距设置.left + 边距设置.right);
                    }
                    
                    // 计算间距总和
                    const 间距总和 = values.reduce((sum, v) => sum + v, 0);
                    
                    // 验证：间距总和必须等于可用空间（允许0.1mm的误差）
                    const 误差 = Math.abs(间距总和 - 可用长度);
                    if (误差 > 0.1) {
                        if (间距总和 > 可用长度) {
                            showModalStatus(
                                '⚠️',
                                '间距设置错误',
                                `${isRow ? '行' : '列'}间距总和: ${间距总和.toFixed(2)} mm，可用空间: ${可用长度.toFixed(2)} mm，超出: ${(间距总和 - 可用长度).toFixed(2)} mm。间距总和必须等于可用空间！`,
                                'error',
                                5000
                            );
                        } else {
                            showModalStatus(
                                '⚠️',
                                '间距设置错误',
                                `${isRow ? '行' : '列'}间距总和: ${间距总和.toFixed(2)} mm，可用空间: ${可用长度.toFixed(2)} mm，不足: ${(可用长度 - 间距总和).toFixed(2)} mm。间距总和必须等于可用空间！`,
                                'error',
                                5000
                            );
                        }
                        return; // 不关闭弹窗，让用户继续修改
                    }
                }
                
                modeInput.value = 'variable';
                valueInput.value = '';
                arrayInput.value = values.join(',');
                更新间距显示(type, 'variable', null, values);
                modal.remove();
                callbacks?.显示状态信息('✅', `${title}已更新`, '', 'success');
            }
        });
    }
    
    // ========== 更新间距显示 ==========
    function 更新间距显示(type, mode, uniformValue, variableArray) {
        const display = document.getElementById(`field-layout-${type}-spacing-display`);
        if (!display) return;
        
        if (mode === 'uniform') {
            display.textContent = `等距: ${uniformValue.toFixed(1)}`;
        } else {
            // 变距模式：只显示模式标识和间距数量
            display.textContent = `变距 (${variableArray.length}个)`;
        }
    }
    
    // ========== 打开半径步长设置弹窗 ==========
    function 打开半径步长设置弹窗() {
        // 获取当前参数
        const layerCount = parseInt(document.getElementById('field-layout-polar-rcount')?.value) || 4;
        const rStart = parseFloat(document.getElementById('field-layout-polar-rstart')?.value) || 0;
        const rStep = parseFloat(document.getElementById('field-layout-polar-rstep')?.value) || 10;
        
        if (layerCount < 2) {
            callbacks?.显示状态信息('⚠️', '层数至少为2才能设置变半径步长', '', 'warning');
            return;
        }
        
        // 判断是否有圆心点（起始半径为0）
        const hasCenter = rStart === 0;
        // 实际需要设置步长的数量（层数-1，如果有圆心则从圆心到第一层也算一个步长）
        const stepCount = layerCount - 1;
        
        if (stepCount < 1) {
            callbacks?.显示状态信息('⚠️', '只有一层，无需设置半径步长', '', 'warning');
            return;
        }
        
        // 获取当前设置
        const modeInput = document.getElementById('field-layout-polar-rstep-mode');
        const arrayInput = document.getElementById('field-layout-polar-rstep-array');
        const uniformInput = document.getElementById('field-layout-polar-rstep');
        
        const currentMode = modeInput?.value || 'uniform';
        const currentUniform = parseFloat(uniformInput?.value) || 10;
        const currentArray = arrayInput?.value ? arrayInput.value.split(',').map(v => parseFloat(v)) : [];
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'field-spacing-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        
        // 生成每层半径步长输入框HTML
        let stepInputsHTML = '';
        
        for (let i = 0; i < stepCount; i++) {
            const fromLayer = i + 1;
            const toLayer = i + 2;
            const fromRadius = rStart + i * currentUniform;
            const value = currentMode === 'variable' && currentArray[i] !== undefined 
                ? currentArray[i] 
                : currentUniform;
            
            let layerDesc = '';
            if (hasCenter && i === 0) {
                layerDesc = `第1层(圆心) → 第2层`;
            } else {
                layerDesc = `第${fromLayer}层 → 第${toLayer}层`;
            }
            
            stepInputsHTML += `
                <div class="spacing-input-row" style="margin-bottom:8px;">
                    <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">${layerDesc} 半径步长 (mm)</label>
                    <input type="number" class="form-input rstep-value-input" data-index="${i}" value="${value}" min="0.1" step="0.1">
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div class="modal-content field-modal" style="max-width:400px;">
                <div class="modal-header">
                    <span>半径步长设置</span>
                    <span class="close-btn" style="cursor:pointer;font-size:24px;">×</span>
                </div>
                <div class="modal-body">
                    <div class="spacing-mode-group">
                        <label style="display:flex;align-items:center;margin-bottom:15px;">
                            <input type="radio" name="rstep-mode" value="uniform" ${currentMode === 'uniform' ? 'checked' : ''} style="margin-right:8px;">
                            <span>等距 (每层步长 ${currentUniform} mm)</span>
                        </label>
                        
                        <label style="display:flex;align-items:center;margin-bottom:10px;">
                            <input type="radio" name="rstep-mode" value="variable" ${currentMode === 'variable' ? 'checked' : ''} style="margin-right:8px;">
                            <span>变距 (共${stepCount}个步长)</span>
                        </label>
                        <div class="rstep-variable-inputs" style="margin-left:24px;max-height:300px;overflow-y:auto;${currentMode === 'variable' ? '' : 'display:none;'}">
                            ${stepInputsHTML}
                            <div style="margin-top:10px;padding:8px;background:#f0f9ff;border-radius:4px;font-size:12px;color:#1e40af;">
                                💡 提示：变半径步长可实现内密外疏或内疏外密的布点
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary close-modal-btn">取消</button>
                    <button class="btn btn-secondary restore-uniform-btn">恢复等距</button>
                    <button class="btn btn-primary confirm-rstep-btn">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 切换模式时显示/隐藏变距输入区域
        const modeRadios = modal.querySelectorAll('input[name="rstep-mode"]');
        const variableInputs = modal.querySelector('.rstep-variable-inputs');
        
        modeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'uniform') {
                    variableInputs.style.display = 'none';
                } else {
                    variableInputs.style.display = 'block';
                }
            });
        });
        
        // 关闭按钮
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());
        
        // 恢复等距按钮
        modal.querySelector('.restore-uniform-btn').addEventListener('click', () => {
            modal.querySelector('input[name="rstep-mode"][value="uniform"]').checked = true;
            modal.querySelector('input[name="rstep-mode"][value="uniform"]').dispatchEvent(new Event('change'));
        });
        
        // 确定按钮
        modal.querySelector('.confirm-rstep-btn').addEventListener('click', () => {
            const selectedMode = modal.querySelector('input[name="rstep-mode"]:checked').value;
            
            if (selectedMode === 'uniform') {
                modeInput.value = 'uniform';
                arrayInput.value = '';
                modal.remove();
                callbacks?.显示状态信息('✅', '半径步长已设为等距', `每层 ${currentUniform} mm`, 'success');
            } else {
                // 收集每层半径步长
                const values = [];
                modal.querySelectorAll('.rstep-value-input').forEach(input => {
                    values.push(parseFloat(input.value) || 10);
                });
                
                // 验证所有值都大于0
                if (values.some(v => v <= 0)) {
                    callbacks?.显示状态信息('⚠️', '半径步长必须大于0', '', 'warning');
                    return;
                }
                
                modeInput.value = 'variable';
                arrayInput.value = values.join(',');
                modal.remove();
                callbacks?.显示状态信息('✅', '半径步长已更新', `${values.map(v => v.toFixed(1)).join(', ')} mm`, 'success');
            }
        });
    }
    
    // ========== 打开每层点数设置弹窗 ==========
    function 打开每层点数设置弹窗() {
        // 获取当前参数
        const layerCount = parseInt(document.getElementById('field-layout-polar-rcount')?.value) || 4;
        const rStart = parseFloat(document.getElementById('field-layout-polar-rstart')?.value) || 0;
        const rStep = parseFloat(document.getElementById('field-layout-polar-rstep')?.value) || 10;
        
        if (layerCount < 1) {
            callbacks?.显示状态信息('⚠️', '请先设置有效的层数', '', 'warning');
            return;
        }
        
        // 判断是否有圆心点（起始半径为0）
        const hasCenter = rStart === 0;
        // 实际需要设置点数的层数（如果有圆心，第一层固定1点）
        const editableLayers = hasCenter ? layerCount - 1 : layerCount;
        
        if (editableLayers < 1) {
            callbacks?.显示状态信息('⚠️', '只有圆心点，无需设置每层点数', '', 'warning');
            return;
        }
        
        // 获取当前设置
        const modeInput = document.getElementById('field-layout-polar-ppr-mode');
        const arrayInput = document.getElementById('field-layout-polar-ppr-array');
        const uniformInput = document.getElementById('field-layout-polar-ppr');
        
        const currentMode = modeInput?.value || 'uniform';
        const currentUniform = parseInt(uniformInput?.value) || 8;
        const currentArray = arrayInput?.value ? arrayInput.value.split(',').map(v => parseInt(v)) : [];
        
        // 创建弹窗
        const modal = document.createElement('div');
        modal.className = 'field-spacing-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        
        // 生成每层点数输入框HTML
        let layerInputsHTML = '';
        
        // 如果有圆心点，显示固定的第一层
        if (hasCenter) {
            layerInputsHTML += `
                <div class="spacing-input-row" style="margin-bottom:8px;opacity:0.7;">
                    <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">第1层 (r=0, 圆心)</label>
                    <input type="number" class="form-input" value="1" disabled style="background:#f3f4f6;cursor:not-allowed;">
                    <span style="font-size:11px;color:#999;margin-left:5px;">固定</span>
                </div>
            `;
        }
        
        // 生成可编辑的层
        for (let i = 0; i < editableLayers; i++) {
            const layerIndex = hasCenter ? i + 1 : i;  // 实际层索引
            const displayIndex = hasCenter ? i + 2 : i + 1;  // 显示的层号
            const radius = rStart + (hasCenter ? (i + 1) : i) * rStep;
            const value = currentMode === 'variable' && currentArray[i] !== undefined 
                ? currentArray[i] 
                : currentUniform;
            layerInputsHTML += `
                <div class="spacing-input-row" style="margin-bottom:8px;">
                    <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">第${displayIndex}层 (r=${radius.toFixed(1)}mm)</label>
                    <input type="number" class="form-input ppr-value-input" data-index="${i}" value="${value}" min="1" step="1">
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div class="modal-content field-modal" style="max-width:400px;">
                <div class="modal-header">
                    <span>每层点数设置</span>
                    <span class="close-btn" style="cursor:pointer;font-size:24px;">×</span>
                </div>
                <div class="modal-body">
                    <div class="spacing-mode-group">
                        <label style="display:flex;align-items:center;margin-bottom:15px;">
                            <input type="radio" name="ppr-mode" value="uniform" ${currentMode === 'uniform' ? 'checked' : ''} style="margin-right:8px;">
                            <span>统一点数 (每层 ${currentUniform} 点${hasCenter ? '，圆心除外' : ''})</span>
                        </label>
                        
                        <label style="display:flex;align-items:center;margin-bottom:10px;">
                            <input type="radio" name="ppr-mode" value="variable" ${currentMode === 'variable' ? 'checked' : ''} style="margin-right:8px;">
                            <span>每层不同 (共${layerCount}层${hasCenter ? '，含圆心' : ''})</span>
                        </label>
                        <div class="ppr-variable-inputs" style="margin-left:24px;max-height:300px;overflow-y:auto;${currentMode === 'variable' ? '' : 'display:none;'}">
                            ${layerInputsHTML}
                            <div style="margin-top:10px;padding:8px;background:#f0f9ff;border-radius:4px;font-size:12px;color:#1e40af;">
                                💡 提示：通常外层点数 ≥ 内层点数
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary close-modal-btn">取消</button>
                    <button class="btn btn-secondary restore-uniform-btn">恢复统一</button>
                    <button class="btn btn-primary confirm-ppr-btn">确定</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 切换模式时显示/隐藏变距输入区域
        const modeRadios = modal.querySelectorAll('input[name="ppr-mode"]');
        const variableInputs = modal.querySelector('.ppr-variable-inputs');
        
        modeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'uniform') {
                    variableInputs.style.display = 'none';
                } else {
                    variableInputs.style.display = 'block';
                }
            });
        });
        
        // 关闭按钮
        modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());
        
        // 恢复统一按钮
        modal.querySelector('.restore-uniform-btn').addEventListener('click', () => {
            modal.querySelector('input[name="ppr-mode"][value="uniform"]').checked = true;
            modal.querySelector('input[name="ppr-mode"][value="uniform"]').dispatchEvent(new Event('change'));
        });
        
        // 确定按钮
        modal.querySelector('.confirm-ppr-btn').addEventListener('click', () => {
            const selectedMode = modal.querySelector('input[name="ppr-mode"]:checked').value;
            
            if (selectedMode === 'uniform') {
                modeInput.value = 'uniform';
                arrayInput.value = '';
                modal.remove();
                callbacks?.显示状态信息('✅', '每层点数已设为统一', `每层 ${currentUniform} 点`, 'success');
            } else {
                // 收集每层点数（不包括圆心）
                const values = [];
                modal.querySelectorAll('.ppr-value-input').forEach(input => {
                    values.push(parseInt(input.value) || 8);
                });
                
                modeInput.value = 'variable';
                arrayInput.value = values.join(',');
                modal.remove();
                callbacks?.显示状态信息('✅', '每层点数已更新', `${values.join(', ')}${hasCenter ? ' (圆心1点)' : ''}`, 'success');
            }
        });
    }
    
    // ========== 切换布点类型 ==========
    function 切换布点类型(type) {
        当前布点类型 = type;
        
        // 隐藏所有参数面板
        document.querySelectorAll('.field-layout-params').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // 显示选中类型的参数面板
        const panel = document.getElementById(`field-layout-${type}-params`);
        if (panel) {
            panel.style.display = 'block';
        }
    }
    
    // ========== 获取布点参数 ==========
    function 获取布点参数() {
        const params = {};
        
        switch (当前布点类型) {
            case 'grid':
                params.rows = parseInt(document.getElementById('field-layout-grid-rows')?.value) || 5;
                params.cols = parseInt(document.getElementById('field-layout-grid-cols')?.value) || 5;
                
                // 使用边距设置对象
                params.margin_left = 边距设置.left;
                params.margin_right = 边距设置.right;
                params.margin_top = 边距设置.top;
                params.margin_bottom = 边距设置.bottom;
                
                // 获取行间距设置
                const rowSpacingMode = document.getElementById('field-layout-row-spacing-mode')?.value || 'uniform';
                if (rowSpacingMode === 'uniform') {
                    // 等距模式：不传variable_row_spacing，让后端使用rows参数均匀分布
                } else {
                    const rowSpacingArray = document.getElementById('field-layout-row-spacing-array')?.value || '';
                    const spacings = 解析间距数组(rowSpacingArray);
                    if (spacings && spacings.length > 0) {
                        params.variable_row_spacing = spacings;
                    }
                }
                
                // 获取列间距设置
                const colSpacingMode = document.getElementById('field-layout-col-spacing-mode')?.value || 'uniform';
                if (colSpacingMode === 'uniform') {
                    // 等距模式：不传variable_col_spacing，让后端使用cols参数均匀分布
                } else {
                    const colSpacingArray = document.getElementById('field-layout-col-spacing-array')?.value || '';
                    const spacings = 解析间距数组(colSpacingArray);
                    if (spacings && spacings.length > 0) {
                        params.variable_col_spacing = spacings;
                    }
                }
                break;
                
            case 'polar':
                params.center_x = parseFloat(document.getElementById('field-layout-polar-cx')?.value) || 50;
                params.center_y = parseFloat(document.getElementById('field-layout-polar-cy')?.value) || 50;
                params.r_start = parseFloat(document.getElementById('field-layout-polar-rstart')?.value) || 0;
                params.r_count = parseInt(document.getElementById('field-layout-polar-rcount')?.value) || 4;
                params.angle_start = parseFloat(document.getElementById('field-layout-polar-astart')?.value) || 0;
                params.angle_end = parseFloat(document.getElementById('field-layout-polar-aend')?.value) || 360;
                
                // 获取半径步长设置
                const rstepMode = document.getElementById('field-layout-polar-rstep-mode')?.value || 'uniform';
                if (rstepMode === 'uniform') {
                    params.r_step = parseFloat(document.getElementById('field-layout-polar-rstep')?.value) || 10;
                } else {
                    const rstepArray = document.getElementById('field-layout-polar-rstep-array')?.value || '';
                    const steps = 解析间距数组(rstepArray);
                    if (steps && steps.length > 0) {
                        params.r_step = steps;  // 传递数组表示变半径步长
                    } else {
                        params.r_step = parseFloat(document.getElementById('field-layout-polar-rstep')?.value) || 10;
                    }
                }
                
                // 获取每层点数设置
                const pprMode = document.getElementById('field-layout-polar-ppr-mode')?.value || 'uniform';
                if (pprMode === 'uniform') {
                    params.points_per_ring = parseInt(document.getElementById('field-layout-polar-ppr')?.value) || 8;
                } else {
                    const pprArray = document.getElementById('field-layout-polar-ppr-array')?.value || '';
                    const points = 解析间距数组(pprArray);
                    if (points && points.length > 0) {
                        params.points_per_ring = points.map(p => Math.round(p));
                    } else {
                        params.points_per_ring = parseInt(document.getElementById('field-layout-polar-ppr')?.value) || 8;
                    }
                }
                break;
                
            case 'adaptive':
                params.base_spacing = parseFloat(document.getElementById('field-layout-adaptive-base')?.value) || 20;
                params.dense_spacing = parseFloat(document.getElementById('field-layout-adaptive-dense')?.value) || 10;
                params.dense_region = {
                    type: document.getElementById('field-layout-adaptive-region-type')?.value || 'circle',
                    centerX: parseFloat(document.getElementById('field-layout-adaptive-region-cx')?.value) || 50,
                    centerY: parseFloat(document.getElementById('field-layout-adaptive-region-cy')?.value) || 50,
                    radius: parseFloat(document.getElementById('field-layout-adaptive-region-r')?.value) || 30
                };
                break;
                
            case 'custom':
                // 自定义布点通过CSV导入
                break;
        }
        
        return params;
    }
    
    // ========== 解析间距数组 ==========
    function 解析间距数组(text) {
        if (!text.trim()) return null;
        return text.split(/[,，\s]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    }
    
    // ========== 生成测点 ==========
    async function 生成测点() {
        // 检查形状是否已设置
        if (!实验状态.形状配置) {
            callbacks?.显示状态信息('⚠️', '请先设置试件形状', '', 'warning');
            return;
        }
        
        // 检查是否有当前实验
        if (!实验状态.当前实验) {
            callbacks?.显示状态信息('⚠️', '请先创建或加载实验', '', 'warning');
            return;
        }
        
        const params = 获取布点参数();
        
        callbacks?.显示状态信息('⏳', '正在生成测点...', '', 'info', 0);
        
        try {
            const result = await pywebview.api.generate_point_layout(
                实验状态.形状配置,
                当前布点类型,
                params
            );
            
            if (result.success) {
                const points = result.points || [];
                
                // 保存测点到数据库
                const saveResult = await pywebview.api.save_point_layout(points);
                if (!saveResult.success) {
                    callbacks?.显示状态信息('⚠️', '测点生成成功但保存失败', saveResult.message, 'warning');
                    return;
                }
                
                // 重新从数据库加载测点（获取完整的 point_index 等字段）
                const expId = 实验状态.当前实验.id || 实验状态.当前实验.experiment_id;
                const loadResult = await pywebview.api.load_field_experiment(expId);
                if (loadResult.success) {
                    // 使用数据库中的完整测点数据
                    实验状态.测点列表 = loadResult.data.points || [];
                    callbacks?.更新测点列表(实验状态.测点列表);
                } else {
                    // 如果加载失败，使用生成的测点（但可能缺少 point_index）
                    实验状态.测点列表 = points;
                    callbacks?.更新测点列表(points);
                }
                
                callbacks?.刷新预览画布?.();
                
                callbacks?.显示状态信息('✅', '测点生成成功', 
                    `共 ${result.valid_count || points.length} 个有效测点`, 'success');
                
                // 更新状态徽章
                更新状态徽章(实验状态.测点列表.length);
            } else {
                callbacks?.显示状态信息('❌', '生成测点失败', result.error || result.message, 'error');
            }
        } catch (error) {
            console.error('[布点面板] 生成测点失败:', error);
            callbacks?.显示状态信息('❌', '生成测点失败', error.toString(), 'error');
        }
    }
    
    // ========== 优化顺序 ==========
    async function 优化顺序() {
        if (!实验状态.测点列表 || 实验状态.测点列表.length === 0) {
            callbacks?.显示状态信息('⚠️', '请先生成测点', '', 'warning');
            return;
        }
        
        // 根据布点类型自动选择优化策略
        let strategy;
        switch (当前布点类型) {
            case 'polar':
                strategy = 'spiral';  // 极坐标用螺旋扫描
                break;
            case 'grid':
                strategy = 'zigzag';  // 网格用之字形扫描
                break;
            default:
                strategy = 'nearest'; // 其他类型用最近邻
        }
        
        callbacks?.显示状态信息('⏳', '正在优化顺序...', '', 'info', 0);
        
        try {
            const result = await pywebview.api.optimize_point_order(实验状态.测点列表, strategy);
            
            if (result.success) {
                const optimizedPoints = result.points || result.optimized_points || [];
                
                // 保存优化后的测点到数据库
                const saveResult = await pywebview.api.save_point_layout(optimizedPoints);
                if (!saveResult.success) {
                    callbacks?.显示状态信息('⚠️', '优化成功但保存失败', saveResult.message, 'warning');
                    return;
                }
                
                // 重新从数据库加载测点
                const expId = 实验状态.当前实验.id || 实验状态.当前实验.experiment_id;
                const loadResult = await pywebview.api.load_field_experiment(expId);
                if (loadResult.success) {
                    实验状态.测点列表 = loadResult.data.points || [];
                } else {
                    实验状态.测点列表 = optimizedPoints;
                }
                
                callbacks?.更新测点列表(实验状态.测点列表);
                callbacks?.刷新预览画布?.();
                callbacks?.刷新数据表格?.();
                
                const strategyNames = { 'zigzag': '之字形', 'spiral': '螺旋', 'nearest': '最近邻' };
                callbacks?.显示状态信息('✅', '顺序优化完成', 
                    `策略: ${strategyNames[strategy] || strategy}, 总距离: ${result.total_distance?.toFixed(1) || '--'} mm`, 'success');
            } else {
                callbacks?.显示状态信息('❌', '优化失败', result.error || result.message, 'error');
            }
        } catch (error) {
            console.error('[布点面板] 优化顺序失败:', error);
            callbacks?.显示状态信息('❌', '优化失败', error.toString(), 'error');
        }
    }
    
    // ========== 清空测点 ==========
    function 清空测点() {
        实验状态.测点列表 = [];
        实验状态.已测点列表 = [];
        实验状态.当前测点索引 = 0;
        
        callbacks?.更新测点列表([]);
        callbacks?.刷新预览画布?.();
        callbacks?.刷新数据表格?.();
        
        更新状态徽章(0);
        callbacks?.显示状态信息('ℹ️', '测点已清空', '', 'info');
    }
    
    // ========== 导入CSV ==========
    async function 导入CSV() {
        try {
            const result = await pywebview.api.select_custom_points_file();
            
            if (!result.success) {
                if (result.message !== '用户取消') {
                    callbacks?.显示状态信息('❌', '选择文件失败', result.error || result.message, 'error');
                }
                return;
            }
            
            // 解析CSV文件（通过generate_point_layout的custom类型）
            const parseResult = await pywebview.api.generate_point_layout(
                实验状态.形状配置,
                'custom',
                { file_path: result.file_path }
            );
            
            if (parseResult.success) {
                const points = parseResult.points || [];
                实验状态.测点列表 = points;
                callbacks?.更新测点列表(points);
                callbacks?.刷新预览画布?.();
                
                更新状态徽章(points.length);
                callbacks?.显示状态信息('✅', 'CSV导入成功', 
                    `共 ${points.length} 个测点`, 'success');
            } else {
                callbacks?.显示状态信息('❌', '解析CSV失败', parseResult.error || parseResult.message, 'error');
            }
        } catch (error) {
            console.error('[布点面板] 导入CSV失败:', error);
            callbacks?.显示状态信息('❌', '导入失败', error.toString(), 'error');
        }
    }
    
    // ========== 更新状态徽章 ==========
    function 更新状态徽章(count) {
        const statusBadge = document.getElementById('field-layout-status');
        if (statusBadge) {
            if (count > 0) {
                statusBadge.textContent = `✅ ${count}个测点`;
                statusBadge.className = 'status-badge success';
            } else {
                statusBadge.textContent = '⚪ 未生成';
                statusBadge.className = 'status-badge';
            }
        }
        
        // 更新测点数量显示
        const countDisplay = document.getElementById('field-layout-count');
        if (countDisplay) {
            countDisplay.textContent = count;
        }
    }
    
    // ========== 更新显示 ==========
    function 更新显示(points) {
        if (!points || points.length === 0) {
            清空();
            return;
        }
        
        更新状态徽章(points.length);
    }
    
    function 清空() {
        更新状态徽章(0);
        
        // 重置布点类型
        当前布点类型 = 'grid';
        document.querySelectorAll('.field-layout-type-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === 'grid') {
                btn.classList.add('active');
            }
        });
        
        // 显示网格参数面板
        document.querySelectorAll('.field-layout-params').forEach(panel => {
            panel.style.display = 'none';
        });
        const gridParams = document.getElementById('field-layout-grid-params');
        if (gridParams) gridParams.style.display = 'block';
        
        // 重置网格参数
        const rowsInput = document.getElementById('field-layout-rows');
        const colsInput = document.getElementById('field-layout-cols');
        const marginInput = document.getElementById('field-layout-margin');
        if (rowsInput) rowsInput.value = '5';
        if (colsInput) colsInput.value = '5';
        if (marginInput) marginInput.value = '10';
    }
    
    // ========== 获取当前布点类型 ==========
    function 获取当前布点类型() {
        return 当前布点类型;
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        切换布点类型,
        获取布点参数,
        获取当前布点类型,
        生成测点,
        优化顺序,
        清空测点,
        导入CSV,
        更新显示,
        清空
    };
})();
