// ==================== 实验管理模块 ====================
// 功能：实验创建、加载、删除、导出

const FieldExperimentManager = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let elements = null;
    let callbacks = null;
    
    // ========== 初始化 ==========
    function 初始化(state, els, cbs) {
        实验状态 = state;
        elements = els;
        callbacks = cbs;

    }
    
    // ========== 新建实验对话框 ==========
    function 打开新建对话框() {
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-new-experiment-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal">
                <div class="modal-header">
                    <h3>📋 新建应力场实验</h3>
                    <button class="modal-close" onclick="FieldExperimentManager.关闭新建对话框()">×</button>
                </div>
                <div class="modal-body">
                    <!-- 必填信息区 -->
                    <div class="form-section">
                        <div class="form-section-title">
                            <span class="section-icon">📌</span>
                            <span>基本信息</span>
                            <span class="required-hint">* 必填</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>实验名称 <span class="required">*</span></label>
                                <input type="text" id="field-exp-name" class="form-input" placeholder="例如：铝板应力分布测试">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>试件材料 <span class="required">*</span></label>
                                    <input type="text" id="field-exp-material" class="form-input" placeholder="例如：6061铝合金">
                                </div>
                                <div class="form-group">
                                    <label>试件厚度 (mm) <span class="required">*</span></label>
                                    <input type="number" id="field-exp-thickness" class="form-input" value="10" min="0.1" step="0.1">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>应力方向 <span class="required">*</span></label>
                                <select id="field-exp-stress-direction" class="form-input">
                                    <option value="">-- 请选择应力方向 --</option>
                                    <option value="0°">0° (X方向)</option>
                                    <option value="45°">45°</option>
                                    <option value="90°">90° (Y方向)</option>
                                    <option value="135°">135°</option>
                                    <option value="custom">自定义...</option>
                                </select>
                                <input type="text" id="field-exp-stress-direction-custom" class="form-input" 
                                       placeholder="输入自定义方向，例如：30°" 
                                       style="display: none; margin-top: 8px;">
                                <small style="color: #666; display: block; margin-top: 4px;">
                                    ℹ️ 单轴应力方向，与标定实验方向一致
                                </small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 可选信息区 -->
                    <div class="form-section optional">
                        <div class="form-section-title">
                            <span class="section-icon">📝</span>
                            <span>补充信息</span>
                            <span class="optional-hint">可选</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>测试目的</label>
                                <textarea id="field-exp-purpose" class="form-input" rows="2" placeholder="描述本次测试的目的..."></textarea>
                            </div>
                            <div class="form-group">
                                <label>操作员</label>
                                <input type="text" id="field-exp-operator" class="form-input" placeholder="操作员姓名">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>环境温度 (°C)</label>
                                    <input type="number" id="field-exp-temperature" class="form-input" value="25" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label>环境湿度 (%)</label>
                                    <input type="number" id="field-exp-humidity" class="form-input" value="50" min="0" max="100">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="FieldExperimentManager.关闭新建对话框()">取消</button>
                    <button class="btn btn-primary" onclick="FieldExperimentManager.创建实验()">创建实验</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 绑定应力方向选择事件
        const directionSelect = document.getElementById('field-exp-stress-direction');
        const customInput = document.getElementById('field-exp-stress-direction-custom');
        if (directionSelect && customInput) {
            directionSelect.addEventListener('change', function() {
                if (this.value === 'custom') {
                    customInput.style.display = 'block';
                    customInput.focus();
                } else {
                    customInput.style.display = 'none';
                }
            });
        }
        
        // 聚焦到名称输入框
        setTimeout(() => {
            document.getElementById('field-exp-name')?.focus();
        }, 100);
    }
    
    function 关闭新建对话框() {
        const modal = document.getElementById('field-new-experiment-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }
    
    // ========== 创建实验 ==========
    async function 创建实验() {
        // 获取表单数据
        const name = document.getElementById('field-exp-name')?.value.trim();
        const material = document.getElementById('field-exp-material')?.value.trim();
        const thickness = parseFloat(document.getElementById('field-exp-thickness')?.value);
        const directionSelect = document.getElementById('field-exp-stress-direction');
        const customDirectionInput = document.getElementById('field-exp-stress-direction-custom');
        
        // 获取应力方向
        let stressDirection = directionSelect?.value || '';
        if (stressDirection === 'custom') {
            stressDirection = customDirectionInput?.value.trim() || '';
        }
        
        const purpose = document.getElementById('field-exp-purpose')?.value.trim();
        const operator = document.getElementById('field-exp-operator')?.value.trim();
        const temperature = parseFloat(document.getElementById('field-exp-temperature')?.value);
        const humidity = parseFloat(document.getElementById('field-exp-humidity')?.value);
        
        // 验证必填字段
        if (!name) {
            callbacks?.显示状态信息('⚠️', '请输入实验名称', '', 'warning');
            document.getElementById('field-exp-name')?.focus();
            return;
        }
        if (!material) {
            callbacks?.显示状态信息('⚠️', '请输入试件材料', '', 'warning');
            document.getElementById('field-exp-material')?.focus();
            return;
        }
        if (!thickness || thickness <= 0) {
            callbacks?.显示状态信息('⚠️', '请输入有效的试件厚度', '', 'warning');
            document.getElementById('field-exp-thickness')?.focus();
            return;
        }
        if (!stressDirection) {
            callbacks?.显示状态信息('⚠️', '请选择应力方向', '单轴应力检测需要明确应力方向', 'warning');
            directionSelect?.focus();
            return;
        }
        
        try {
            const result = await pywebview.api.create_field_experiment({
                name: name,
                sample_material: material,
                sample_thickness: thickness,
                stress_direction: stressDirection,
                test_purpose: purpose,
                operator: operator,
                temperature: temperature,
                humidity: humidity
            });
            
            if (result.success) {
                关闭新建对话框();
                callbacks?.显示状态信息('✅', '实验创建成功', `ID: ${result.data.exp_id}`, 'success');
                
                // 加载新创建的实验
                await callbacks?.加载实验数据(result.data.exp_id);
            } else {
                callbacks?.显示状态信息('❌', '创建实验失败', result.message, 'error');
            }
        } catch (error) {
            console.error('[实验管理] 创建实验失败:', error);
            callbacks?.显示状态信息('❌', '创建实验失败', error.toString(), 'error');
        }
    }
    
    // ========== 实验管理对话框 ==========
    async function 打开管理对话框() {
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-manage-experiments-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-lg" style="max-height: 80vh;">
                <div class="modal-header">
                    <h3>📁 实验管理</h3>
                    <button class="modal-close" onclick="FieldExperimentManager.关闭管理对话框()">×</button>
                </div>
                <div class="modal-body" style="max-height: 55vh;">
                    <div id="field-experiment-list" class="experiment-list">
                        <div class="loading">加载中...</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="FieldExperimentManager.关闭管理对话框()">关闭</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // 加载实验列表
        await 加载实验列表();
    }
    
    function 关闭管理对话框() {
        const modal = document.getElementById('field-manage-experiments-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }
    
    // ========== 加载实验列表 ==========
    async function 加载实验列表() {
        const container = document.getElementById('field-experiment-list');
        if (!container) return;
        
        try {
            const result = await pywebview.api.get_field_experiment_list();
            
            if (!result.success) {
                container.innerHTML = `<div class="error">加载失败: ${result.message}</div>`;
                return;
            }
            
            const experiments = result.data || [];
            
            if (experiments.length === 0) {
                container.innerHTML = '<div class="empty">暂无实验记录</div>';
                return;
            }
            
            container.innerHTML = experiments.map(exp => {
                // 兼容 id 和 experiment_id 两种字段名
                const currentExpId = 实验状态?.当前实验?.id || 实验状态?.当前实验?.experiment_id;
                const isActive = currentExpId === exp.experiment_id;
                return `
                <div class="experiment-item ${isActive ? 'active' : ''}">
                    <div class="experiment-info">
                        <div class="experiment-name">${exp.name || exp.experiment_id}</div>
                        <div class="experiment-meta">
                            <span class="status status-${exp.status}">${getStatusText(exp.status)}</span>
                            <span class="date">${formatDate(exp.created_at)}</span>
                            <span class="material">${exp.sample_material || '--'}</span>
                        </div>
                    </div>
                    <div class="experiment-actions">
                        <button class="btn btn-sm btn-primary" onclick="FieldExperimentManager.加载实验('${exp.experiment_id}')" title="加载">
                            📂 加载
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="FieldExperimentManager.导出实验('${exp.experiment_id}')" title="导出">
                            📤 导出
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="FieldExperimentManager.删除实验('${exp.experiment_id}', '${exp.name}')" title="删除">
                            🗑️
                        </button>
                    </div>
                </div>
            `}).join('');
            
        } catch (error) {
            console.error('[实验管理] 加载实验列表失败:', error);
            container.innerHTML = `<div class="error">加载失败: ${error.toString()}</div>`;
        }
    }

    
    // ========== 加载实验 ==========
    async function 加载实验(expId) {
        // 检查是否有未保存的实验
        if (实验状态?.当前实验 && 实验状态.当前实验.status === 'collecting') {
            const confirmed = await StressDetectionUniaxialModule.显示确认对话框(
                '切换实验',
                '当前有正在进行的实验，确定要切换吗？\n\n已采集的数据会自动保存。'
            );
            if (!confirmed) return;
        }
        
        关闭管理对话框();
        await callbacks?.加载实验数据(expId);
    }
    
    // ========== 删除实验 ==========
    async function 删除实验(expId, expName) {
        const confirmed = await StressDetectionUniaxialModule.显示确认对话框(
            '删除实验',
            `确定要删除实验"${expName}"吗？\n\n此操作将删除所有相关数据，且无法恢复！`
        );
        
        if (!confirmed) return;
        
        try {
            const result = await pywebview.api.delete_field_experiment(expId);
            
            if (result.success) {
                callbacks?.显示状态信息('✅', '实验已删除', '', 'success');
                
                // 如果删除的是当前实验，清空数据（兼容 id 和 experiment_id 两种字段名）
                const currentExpId = 实验状态?.当前实验?.id || 实验状态?.当前实验?.experiment_id;
                if (currentExpId === expId) {
                    callbacks?.清空实验数据();
                }
                
                // 刷新列表
                await 加载实验列表();
            } else {
                callbacks?.显示状态信息('❌', '删除失败', result.message, 'error');
            }
        } catch (error) {
            console.error('[实验管理] 删除实验失败:', error);
            callbacks?.显示状态信息('❌', '删除失败', error.toString(), 'error');
        }
    }
    
    // ========== 导出实验 ==========
    async function 导出实验(expId) {
        // 🆕 先获取实验信息，检查状态
        try {
            const expResult = await pywebview.api.load_field_experiment(expId);
            if (!expResult.success) {
                callbacks?.显示状态信息('❌', '加载实验失败', expResult.message, 'error');
                return;
            }
            
            const experiment = expResult.data.experiment;
            
            // 🆕 检查实验是否已完成
            if (experiment.status !== 'completed') {
                callbacks?.显示状态信息('⚠️', '无法导出', '只能导出已完成的实验', 'warning');
                return;
            }
        } catch (error) {
            console.error('[实验管理] 检查实验状态失败:', error);
            callbacks?.显示状态信息('❌', '操作失败', error.toString(), 'error');
            return;
        }
        
        // 显示导出选项对话框
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-export-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-sm">
                <div class="modal-header">
                    <h3>📤 导出数据</h3>
                    <button class="modal-close" onclick="document.getElementById('field-export-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section">
                        <div class="form-section-title">
                            <span class="section-icon">📄</span>
                            <span>导出选项</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>导出格式</label>
                                <select id="field-export-format" class="form-input">
                                    <option value="csv">CSV (测点数据)</option>
                                    <option value="excel">Excel (完整报告)</option>
                                    <option value="hdf5">HDF5 (含波形数据)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="field-export-contour" checked style="width: 16px; height: 16px;">
                                    <span style="font-weight: normal;">同时导出云图图片</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('field-export-modal').remove()">取消</button>
                    <button class="btn btn-primary" onclick="FieldExperimentManager.执行导出('${expId}')">导出</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    async function 执行导出(expId) {
        const format = document.getElementById('field-export-format')?.value || 'csv';
        const exportContour = document.getElementById('field-export-contour')?.checked || false;
        
        // 关闭对话框
        document.getElementById('field-export-modal')?.remove();
        
        callbacks?.显示状态信息('⏳', '正在导出...', '', 'info', 0);
        
        try {
            // 导出数据
            const result = await pywebview.api.export_field_data(expId, format, {});
            
            if (!result.success) {
                callbacks?.显示状态信息('❌', '导出失败', result.error || result.message, 'error');
                return;
            }
            
            let message = `数据已导出: ${result.file_path || result.data?.file_path || ''}`;
            
            // 导出云图
            if (exportContour) {
                const contourResult = await pywebview.api.export_contour_image(expId, 'png', 300);
                if (contourResult.success) {
                    message += `\n云图已导出: ${contourResult.file_path || contourResult.data?.file_path || ''}`;
                }
            }
            
            callbacks?.显示状态信息('✅', '导出成功', message, 'success', 5000);
            
        } catch (error) {
            console.error('[实验管理] 导出失败:', error);
            callbacks?.显示状态信息('❌', '导出失败', error.toString(), 'error');
        }
    }
    
    // ========== 工具函数 ==========
    function getStatusText(status) {
        const map = {
            'planning': '规划中',
            'collecting': '采集中',
            'completed': '已完成'
        };
        return map[status] || status;
    }
    
    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        打开新建对话框,
        关闭新建对话框,
        创建实验,
        打开管理对话框,
        关闭管理对话框,
        加载实验,
        删除实验,
        导出实验,
        执行导出
    };
})();
