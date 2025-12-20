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
                
                // 检查是否使用变间距
                const useVariableSpacing = document.getElementById('field-layout-grid-variable')?.checked;
                if (useVariableSpacing) {
                    const rowSpacingText = document.getElementById('field-layout-grid-row-spacing')?.value || '';
                    const colSpacingText = document.getElementById('field-layout-grid-col-spacing')?.value || '';
                    params.row_spacing = 解析间距数组(rowSpacingText);
                    params.col_spacing = 解析间距数组(colSpacingText);
                }
                break;
                
            case 'polar':
                params.center_x = parseFloat(document.getElementById('field-layout-polar-cx')?.value) || 50;
                params.center_y = parseFloat(document.getElementById('field-layout-polar-cy')?.value) || 50;
                params.r_min = parseFloat(document.getElementById('field-layout-polar-rmin')?.value) || 10;
                params.r_max = parseFloat(document.getElementById('field-layout-polar-rmax')?.value) || 40;
                params.r_count = parseInt(document.getElementById('field-layout-polar-rcount')?.value) || 4;
                params.angle_start = parseFloat(document.getElementById('field-layout-polar-astart')?.value) || 0;
                params.angle_end = parseFloat(document.getElementById('field-layout-polar-aend')?.value) || 360;
                params.points_per_ring = parseInt(document.getElementById('field-layout-polar-ppr')?.value) || 8;
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
        return text.split(/[,\s]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    }
    
    // ========== 生成测点 ==========
    async function 生成测点() {
        // 检查形状是否已设置
        if (!实验状态.形状配置) {
            callbacks?.显示状态信息('⚠️', '请先设置试件形状', '', 'warning');
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
                
                // 更新状态
                实验状态.测点列表 = points;
                callbacks?.更新测点列表(points);
                callbacks?.刷新预览画布?.();
                
                callbacks?.显示状态信息('✅', '测点生成成功', 
                    `共 ${result.valid_count || points.length} 个有效测点`, 'success');
                
                // 更新状态徽章
                更新状态徽章(points.length);
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
        
        const strategy = document.getElementById('field-layout-optimize-strategy')?.value || 'zigzag';
        
        callbacks?.显示状态信息('⏳', '正在优化顺序...', '', 'info', 0);
        
        try {
            const result = await pywebview.api.optimize_point_order(实验状态.测点列表, strategy);
            
            if (result.success) {
                const optimizedPoints = result.points || result.optimized_points || [];
                实验状态.测点列表 = optimizedPoints;
                callbacks?.更新测点列表(optimizedPoints);
                callbacks?.刷新预览画布?.();
                callbacks?.刷新数据表格?.();
                
                callbacks?.显示状态信息('✅', '顺序优化完成', 
                    `总移动距离: ${result.total_distance?.toFixed(1) || '--'} mm`, 'success');
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
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        切换布点类型,
        获取布点参数,
        生成测点,
        优化顺序,
        清空测点,
        导入CSV,
        更新显示,
        清空
    };
})();
