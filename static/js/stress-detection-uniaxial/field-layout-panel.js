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
                params.margin_left = parseFloat(document.getElementById('field-layout-grid-margin-left')?.value) || 10;
                params.margin_right = parseFloat(document.getElementById('field-layout-grid-margin-right')?.value) || 10;
                params.margin_top = parseFloat(document.getElementById('field-layout-grid-margin-top')?.value) || 10;
                params.margin_bottom = parseFloat(document.getElementById('field-layout-grid-margin-bottom')?.value) || 10;
                
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
