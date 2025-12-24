// ==================== 标定数据面板模块 ====================
// 功能：标定数据来源切换、加载、验证、显示

const FieldCalibrationPanel = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let elements = null;
    let callbacks = null;
    
    // 当前选择的数据来源
    let 当前来源 = 'local';  // 'local' | 'file' | 'manual'
    
    // ========== 初始化 ==========
    function 初始化(state, els, cbs) {
        实验状态 = state;
        elements = els;
        callbacks = cbs;
        
        // 绑定事件
        绑定事件();

    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 数据来源切换
        document.querySelectorAll('input[name="field-calib-source"]').forEach(radio => {
            radio.addEventListener('change', function() {
                切换来源(this.value);
            });
        });
        
        // 从本地实验加载按钮
        const loadLocalBtn = document.getElementById('field-calib-load-local');
        if (loadLocalBtn) {
            loadLocalBtn.addEventListener('click', 从本地加载);
        }
        
        // 手动输入确认按钮
        const confirmManualBtn = document.getElementById('field-calib-confirm-manual');
        if (confirmManualBtn) {
            confirmManualBtn.addEventListener('click', 确认手动输入);
        }
    }
    
    // ========== 切换数据来源 ==========
    function 切换来源(source) {
        当前来源 = source;
        
        // 隐藏所有来源面板
        document.querySelectorAll('.field-calib-source-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // 显示选中的来源面板
        const panel = document.getElementById(`field-calib-${source}-panel`);
        if (panel) {
            panel.style.display = 'block';
        }
    }
    
    // ========== 从本地实验加载 ==========
    async function 从本地加载() {
        // 打开实验选择对话框
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-calib-select-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-lg" style="max-height: 75vh;">
                <div class="modal-header">
                    <h3>📊 选择标定实验</h3>
                    <button class="modal-close" onclick="document.getElementById('field-calib-select-modal').remove()">×</button>
                </div>
                <div class="modal-body" style="max-height: 55vh;">
                    <div id="field-calib-exp-list" class="experiment-list">
                        <div class="loading">加载中...</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('field-calib-select-modal').remove()">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 加载标定实验列表
        await 加载标定实验列表();
    }
    
    async function 加载标定实验列表() {
        const container = document.getElementById('field-calib-exp-list');
        if (!container) return;
        
        try {
            const result = await pywebview.api.获取所有实验列表();
            
            if (!result.success) {
                container.innerHTML = `<div class="error">加载失败: ${result.message}</div>`;
                return;
            }
            
            const experiments = result.data || [];
            
            // 过滤出有拟合结果的实验
            const validExps = experiments.filter(exp => 
                exp.directions && exp.directions.some(d => d.拟合结果)
            );
            
            if (validExps.length === 0) {
                container.innerHTML = '<div class="empty">暂无可用的标定数据<br><small>请先在"应力系数标定"模块完成标定实验</small></div>';
                return;
            }
            
            let html = '';
            validExps.forEach(exp => {
                // 兼容不同的字段名
                const expId = exp.实验ID || exp.id || exp.experiment_id;
                const material = exp.材料名称 || exp.material || exp.sample_material || '未知材料';
                
                exp.directions.forEach(dir => {
                    if (dir.拟合结果) {
                        const dirName = dir.方向名称 || dir.direction || dir.name || '未知方向';
                        const k = dir.拟合结果.k;
                        const kFormatted = k.toFixed(2);  // 保留两位小数
                        html += `
                            <div class="calibration-item" onclick="FieldCalibrationPanel.选择标定数据(${expId}, '${dirName}')">
                                <div class="direction-name">${material} - ${dirName}</div>
                                <div class="calibration-info">
                                    <span>K = ${kFormatted} MPa/ns</span>
                                    <span>R² = ${dir.拟合结果.r_squared?.toFixed(4) || '--'}</span>
                                </div>
                            </div>
                        `;
                    }
                });
            });
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('[标定面板] 加载标定实验列表失败:', error);
            container.innerHTML = `<div class="error">加载失败: ${error.toString()}</div>`;
        }
    }
    
    async function 选择标定数据(expId, direction) {
        try {
            const result = await pywebview.api.load_calibration_from_experiment(expId, direction);
            
            if (result.success) {
                // 关闭选择对话框
                document.getElementById('field-calib-select-modal')?.remove();
                
                // 更新显示
                更新显示(result.data);
                
                // 回调通知主模块
                callbacks?.更新标定数据(result.data);
            } else {
                callbacks?.显示状态信息('❌', '加载标定数据失败', result.message, 'error');
            }
        } catch (error) {
            console.error('[标定面板] 加载标定数据失败:', error);
            callbacks?.显示状态信息('❌', '加载标定数据失败', error.toString(), 'error');
        }
    }
    
    
    // ========== 手动输入 ==========
    function 确认手动输入() {
        const kInput = document.getElementById('field-calib-manual-k');
        const k = parseFloat(kInput?.value);
        
        // 🔧 修复：允许负数（复合材料单向板在某些方向应力系数为负）
        if (isNaN(k) || k === 0) {
            callbacks?.显示状态信息('⚠️', '请输入有效的应力系数', 'K值不能为0', 'warning');
            kInput?.focus();
            return;
        }
        
        // 验证范围（允许负数）
        if (Math.abs(k) < 0.01 || Math.abs(k) > 20) {
            callbacks?.显示状态信息('⚠️', '应力系数超出正常范围', '建议范围: ±0.01 ~ ±20 MPa/ns', 'warning');
        }
        
        const data = {
            k: k,
            source: 'manual',
            r_squared: null,
            slope: k,
            intercept: 0
        };
        
        更新显示(data);
        callbacks?.更新标定数据(data);
    }
    
    // ========== 更新显示 ==========
    function 更新显示(data) {
        if (!data) {
            清空();
            return;
        }
        
        // 🔧 修复：确保 k 值存在且有效（允许负数）
        const k = data.k;
        if (k === null || k === undefined || k === 0) {
            console.warn('[标定面板] K值无效:', data.k);
            清空();
            return;
        }
        
        实验状态.标定数据 = data;
        
        // 🔧 修复：根据数据来源切换到对应的面板
        const source = data.source || 'manual';
        当前来源 = source;
        
        // 更新单选按钮
        const sourceRadio = document.querySelector(`input[name="field-calib-source"][value="${source}"]`);
        if (sourceRadio) {
            sourceRadio.checked = true;
        }
        
        // 切换面板显示
        document.querySelectorAll('.field-calib-source-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        const panel = document.getElementById(`field-calib-${source}-panel`);
        if (panel) {
            panel.style.display = 'block';
        }
        
        // 🔧 修复：如果是手动输入，恢复输入框的值
        if (source === 'manual') {
            const kInput = document.getElementById('field-calib-manual-k');
            if (kInput) {
                kInput.value = k.toFixed(2);
            }
        }
        
        // 格式化K值：保留两位小数
        const kFormatted = k.toFixed(2);
        
        // 更新信息显示
        const infoPanel = document.getElementById('field-calib-info');
        if (infoPanel) {
            const sourceText = {
                'local': '本地实验',
                'file': '文件导入',
                'manual': '手动输入'
            };
            
            infoPanel.innerHTML = `
                <div class="calib-info-item">
                    <span class="label">应力系数 K:</span>
                    <span class="value">${kFormatted} MPa/ns</span>
                </div>
                ${data.r_squared !== null && data.r_squared !== undefined ? `
                <div class="calib-info-item">
                    <span class="label">拟合度 R²:</span>
                    <span class="value">${data.r_squared.toFixed(4)}</span>
                </div>
                ` : ''}
                <div class="calib-info-item">
                    <span class="label">数据来源:</span>
                    <span class="value">${sourceText[data.source] || data.source || '未知'}</span>
                </div>
                ${data.exp_id ? `
                <div class="calib-info-item">
                    <span class="label">标定实验:</span>
                    <span class="value">ID ${data.exp_id}${data.direction ? ` - ${data.direction}` : ''}</span>
                </div>
                ` : ''}
            `;
            infoPanel.style.display = 'block';
        }
        
        // 显示已加载状态
        const statusBadge = document.getElementById('field-calib-status');
        if (statusBadge) {
            statusBadge.textContent = '✅ 已加载';
            statusBadge.className = 'status-badge success';
        }
    }
    
    // ========== 清空 ==========
    function 清空() {
        const infoPanel = document.getElementById('field-calib-info');
        if (infoPanel) {
            infoPanel.innerHTML = '<div class="empty">未加载标定数据</div>';
        }
        
        const statusBadge = document.getElementById('field-calib-status');
        if (statusBadge) {
            statusBadge.textContent = '⚪ 未加载';
            statusBadge.className = 'status-badge';
        }
        
        // 🆕 清空手动输入表单
        const manualInputs = [
            'field-calib-manual-k',
            'field-calib-manual-exp-id',
            'field-calib-manual-direction',
            'field-calib-manual-material',
            'field-calib-manual-thickness'
        ];
        
        manualInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
            }
        });

    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        切换来源,
        从本地加载,
        确认手动输入,
        选择标定数据,
        更新显示,
        清空,
        // 🆕 禁用/启用面板
        禁用: function() {
            // 禁用数据来源单选按钮
            document.querySelectorAll('input[name="field-calib-source"]').forEach(radio => {
                radio.disabled = true;
            });
            
            // 禁用所有按钮
            const buttons = ['field-calib-load-local', 'field-calib-confirm-manual'];
            buttons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = true;
            });
            
            // 禁用手动输入框
            const manualInput = document.getElementById('field-calib-manual-k');
            if (manualInput) manualInput.disabled = true;
        },
        启用: function() {
            // 启用数据来源单选按钮
            document.querySelectorAll('input[name="field-calib-source"]').forEach(radio => {
                radio.disabled = false;
            });
            
            // 启用所有按钮
            const buttons = ['field-calib-load-local', 'field-calib-confirm-manual'];
            buttons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = false;
            });
            
            // 启用手动输入框
            const manualInput = document.getElementById('field-calib-manual-k');
            if (manualInput) manualInput.disabled = false;
        }
    };
})();
