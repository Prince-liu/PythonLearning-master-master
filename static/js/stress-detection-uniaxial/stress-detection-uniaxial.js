// ==================== 应力场测绘主模块 ====================
// 功能：协调各子模块、状态管理、标签页切换、初始化

const StressDetectionUniaxialModule = (function() {
    'use strict';
    
    // ========== 全局状态 ==========
    let 实验状态 = {
        当前实验: null,           // 当前加载的实验对象
        标定数据: null,           // 标定系数信息
        标定系数: 0,              // 应力系数 k (MPa/ns)
        形状配置: null,           // 形状定义
        测点列表: [],             // 生成的测点
        已测点列表: [],           // 已采集的测点索引
        已测点数据: [],           // 已采集的测点数据（含应力值）
        基准点ID: null,           // 基准测点ID
        当前测点索引: 0,          // 当前采集的测点索引
        实时监控中: false,        // 监控状态
        云图数据: null,           // 云图插值数据
        自动保存状态: 'idle',     // 'idle' | 'saving' | 'saved' | 'error'
        应力计算模式: 'relative', // 'relative' | 'absolute'
        基准点应力值: 0           // 绝对应力模式下的基准点应力值 (MPa)
    };
    
    // DOM 元素缓存
    let elements = {};
    
    // 子模块引用
    let 子模块 = {
        实验管理: null,
        标定面板: null,
        形状面板: null,
        布点面板: null,
        基准管理: null,
        质量检查: null,
        采集面板: null,
        预览画布: null,
        云图显示: null
    };
    
    // 质量检查模式
    let 质量检查模式 = 'strict'; // 'strict' | 'fast'
    
    // ========== 初始化 ==========
    function 初始化() {
        console.log('[应力场测绘] 初始化主模块...');
        
        // 缓存DOM元素
        缓存DOM元素();
        
        // 绑定事件
        绑定事件();
        
        // 初始化子模块（按依赖顺序）
        初始化子模块();
        
        console.log('[应力场测绘] 主模块初始化完成');
    }
    
    // ========== DOM元素缓存 ==========
    function 缓存DOM元素() {
        elements = {
            // 实验信息区
            experimentInfo: document.getElementById('field-experiment-info'),
            experimentName: document.getElementById('field-experiment-name'),
            experimentStatus: document.getElementById('field-experiment-status'),
            experimentProgress: document.getElementById('field-experiment-progress'),
            autoSaveStatus: document.getElementById('field-autosave-status'),
            
            // 控制按钮
            newExperimentBtn: document.getElementById('field-new-experiment-btn'),
            manageExperimentsBtn: document.getElementById('field-manage-experiments-btn'),
            completeExperimentBtn: document.getElementById('field-complete-experiment-btn'),
            
            // 折叠面板
            calibrationPanel: document.getElementById('field-calibration-panel'),
            shapePanel: document.getElementById('field-shape-panel'),
            layoutPanel: document.getElementById('field-layout-panel'),
            baselinePanel: document.getElementById('field-baseline-panel'),
            qualityPanel: document.getElementById('field-quality-panel'),
            capturePanel: document.getElementById('field-capture-panel'),
            
            // 画布区域
            previewCanvas: document.getElementById('field-preview-canvas'),
            contourCanvas: document.getElementById('field-contour-canvas'),
            waveformCanvas: document.getElementById('field-waveform-canvas'),
            
            // 数据表格
            dataTable: document.getElementById('field-data-table'),
            dataTableBody: document.getElementById('field-data-table-body'),
            
            // 状态栏
            statusBar: document.getElementById('field-status-bar'),
            statusIcon: document.getElementById('field-status-icon'),
            statusText: document.getElementById('field-status-text'),
            statusDetail: document.getElementById('field-status-detail')
        };
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 新建实验按钮
        if (elements.newExperimentBtn) {
            elements.newExperimentBtn.addEventListener('click', () => {
                if (子模块.实验管理) {
                    子模块.实验管理.打开新建对话框();
                }
            });
        }
        
        // 管理实验按钮
        if (elements.manageExperimentsBtn) {
            elements.manageExperimentsBtn.addEventListener('click', () => {
                if (子模块.实验管理) {
                    子模块.实验管理.打开管理对话框();
                }
            });
        }
        
        // 完成实验按钮
        if (elements.completeExperimentBtn) {
            elements.completeExperimentBtn.addEventListener('click', 完成当前实验);
        }
        
        // 折叠面板切换
        document.querySelectorAll('.field-panel-header').forEach(header => {
            header.addEventListener('click', function() {
                const panel = this.closest('.field-panel');
                if (panel) {
                    panel.classList.toggle('collapsed');
                }
            });
        });
        
        // 数据导出面板事件
        绑定导出面板事件();
        
        // 基准波形管理面板事件
        绑定基准面板事件();
        
        // 质量检查模式面板事件
        绑定质量检查面板事件();
    }
    
    // ========== 基准波形管理面板事件绑定 ==========
    function 绑定基准面板事件() {
        // 查看波形按钮
        const viewBtn = document.getElementById('field-baseline-view');
        if (viewBtn) {
            viewBtn.addEventListener('click', async () => {
                if (!实验状态.基准点ID) {
                    显示状态信息('⚠️', '未设置基准点', '', 'warning');
                    return;
                }
                // TODO: 显示基准波形对话框
                显示状态信息('ℹ️', '查看基准波形', `基准点: #${实验状态.基准点ID}`, 'info');
            });
        }
        
        // 更换基准点按钮
        const changeBtn = document.getElementById('field-baseline-change');
        if (changeBtn) {
            changeBtn.addEventListener('click', async () => {
                if (实验状态.测点列表.length === 0) {
                    显示状态信息('⚠️', '请先生成测点', '', 'warning');
                    return;
                }
                // TODO: 打开基准点选择对话框
                显示状态信息('ℹ️', '选择新的基准点', '请在预览画布中点击测点', 'info');
            });
        }
        
        // 应力计算模式切换
        const stressModeRadios = document.querySelectorAll('input[name="field-stress-mode"]');
        const absoluteStressInput = document.getElementById('field-absolute-stress-input');
        const baselineStressValue = document.getElementById('field-baseline-stress-value');
        
        stressModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                实验状态.应力计算模式 = mode;
                
                // 显示/隐藏绝对应力输入框
                if (absoluteStressInput) {
                    absoluteStressInput.style.display = mode === 'absolute' ? 'block' : 'none';
                }
                
                // 更新应力值显示
                if (mode === 'relative') {
                    实验状态.基准点应力值 = 0;
                    显示状态信息('✅', '已切换到相对应力模式', '基准点应力 = 0 MPa', 'success');
                } else {
                    const value = parseFloat(baselineStressValue?.value) || 0;
                    实验状态.基准点应力值 = value;
                    显示状态信息('✅', '已切换到绝对应力模式', `基准点应力 = ${value} MPa`, 'success');
                }
                
                // 重新计算所有测点的应力值
                重新计算应力值();
            });
        });
        
        // 基准点应力值输入
        if (baselineStressValue) {
            baselineStressValue.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value) || 0;
                实验状态.基准点应力值 = value;
                
                if (实验状态.应力计算模式 === 'absolute') {
                    显示状态信息('✅', '基准点应力值已更新', `${value} MPa`, 'success');
                    // 重新计算所有测点的应力值
                    重新计算应力值();
                }
            });
        }
    }
    
    // ========== 重新计算应力值 ==========
    function 重新计算应力值() {
        // 如果没有已测点，直接返回
        if (!实验状态.已测点数据 || 实验状态.已测点数据.length === 0) {
            return;
        }
        
        const k = 实验状态.标定系数;
        const baselineStress = 实验状态.基准点应力值 || 0;
        
        // 更新每个测点的应力值
        实验状态.已测点数据.forEach(point => {
            if (point.time_diff !== undefined && point.time_diff !== null) {
                // σ = σ_基准 + k × Δt
                point.stress_value = baselineStress + k * point.time_diff;
            }
        });
        
        // 更新表格显示
        if (typeof FieldCapturePanel !== 'undefined' && FieldCapturePanel.更新数据表格) {
            FieldCapturePanel.更新数据表格();
        }
        
        // 更新云图
        if (typeof FieldContour !== 'undefined' && FieldContour.更新云图) {
            FieldContour.更新云图();
        }
    }
    
    // ========== 质量检查模式面板事件绑定 ==========
    function 绑定质量检查面板事件() {
        const modeCards = document.querySelectorAll('.field-quality-mode-card');
        const modeDesc = document.getElementById('field-quality-mode-desc');
        
        const modeDescriptions = {
            'strict': '适合正式实验和高精度测量',
            'fast': '适合快速预览和粗略测量'
        };
        
        modeCards.forEach(card => {
            card.addEventListener('click', () => {
                // 移除所有选中状态
                modeCards.forEach(c => c.classList.remove('selected'));
                // 添加当前选中状态
                card.classList.add('selected');
                
                // 更新模式
                质量检查模式 = card.dataset.mode;
                
                // 更新描述
                if (modeDesc) {
                    modeDesc.textContent = modeDescriptions[质量检查模式] || '';
                }
                
                显示状态信息('✅', `已切换到${质量检查模式 === 'strict' ? '严格' : '快速'}模式`, '', 'success');
            });
        });
    }
    
    // ========== 导出面板事件绑定 ==========
    function 绑定导出面板事件() {
        const exportBtn = document.getElementById('field-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                if (!实验状态.当前实验) {
                    显示状态信息('⚠️', '请先加载实验', '', 'warning');
                    return;
                }
                
                const format = document.getElementById('field-export-format')?.value || 'csv';
                const includeWaveforms = document.getElementById('field-export-include-waveforms')?.checked || false;
                const includeContour = document.getElementById('field-export-include-contour')?.checked || false;
                const includeStats = document.getElementById('field-export-include-stats')?.checked || false;
                
                显示状态信息('⏳', '正在导出...', '', 'info', 0);
                
                try {
                    const result = await pywebview.api.export_field_data(
                        实验状态.当前实验.experiment_id, 
                        format, 
                        {
                            include_waveforms: includeWaveforms,
                            include_stats: includeStats
                        }
                    );
                    
                    if (!result.success) {
                        显示状态信息('❌', '导出失败', result.message, 'error');
                        return;
                    }
                    
                    let message = `数据已导出`;
                    
                    // 导出云图
                    if (includeContour && 子模块.云图显示) {
                        子模块.云图显示.导出云图图片();
                    }
                    
                    显示状态信息('✅', '导出成功', message, 'success', 5000);
                    
                } catch (error) {
                    console.error('[应力场测绘] 导出失败:', error);
                    显示状态信息('❌', '导出失败', error.toString(), 'error');
                }
            });
        }
    }
    
    // ========== 子模块初始化 ==========
    function 初始化子模块() {
        // 实验管理模块
        if (typeof FieldExperimentManager !== 'undefined') {
            子模块.实验管理 = FieldExperimentManager;
            子模块.实验管理.初始化(实验状态, elements, {
                显示状态信息,
                更新实验信息显示,
                加载实验数据,
                清空实验数据
            });
        }
        
        // 标定面板模块
        if (typeof FieldCalibrationPanel !== 'undefined') {
            子模块.标定面板 = FieldCalibrationPanel;
            子模块.标定面板.初始化(实验状态, elements, {
                显示状态信息,
                更新标定数据
            });
        }
        
        // 形状面板模块
        if (typeof FieldShapePanel !== 'undefined') {
            子模块.形状面板 = FieldShapePanel;
            子模块.形状面板.初始化(实验状态, elements, {
                显示状态信息,
                更新形状配置,
                刷新预览画布: () => 子模块.预览画布?.刷新()
            });
        }
        
        // 布点面板模块
        if (typeof FieldLayoutPanel !== 'undefined') {
            子模块.布点面板 = FieldLayoutPanel;
            子模块.布点面板.初始化(实验状态, elements, {
                显示状态信息,
                更新测点列表,
                刷新预览画布: () => 子模块.预览画布?.刷新(),
                刷新数据表格
            });
        }
        
        // 采集面板模块
        if (typeof FieldCapturePanel !== 'undefined') {
            子模块.采集面板 = FieldCapturePanel;
            子模块.采集面板.初始化(实验状态, elements, {
                显示状态信息,
                更新测点状态,
                刷新预览画布: () => 子模块.预览画布?.刷新(),
                刷新云图: () => 子模块.云图显示?.刷新(),
                刷新数据表格
            });
        }
        
        // 预览画布模块
        if (typeof FieldCanvas !== 'undefined') {
            子模块.预览画布 = FieldCanvas;
            子模块.预览画布.初始化(实验状态, elements.previewCanvas, {
                显示状态信息,
                选中测点: (pointId) => 子模块.采集面板?.跳转到测点(pointId)
            });
        }
        
        // 云图显示模块
        if (typeof FieldContour !== 'undefined') {
            子模块.云图显示 = FieldContour;
            子模块.云图显示.初始化(实验状态, elements.contourCanvas, {
                显示状态信息
            });
        }
        
        // 面板拖拽和折叠模块
        if (typeof FieldResizer !== 'undefined') {
            FieldResizer.初始化({
                刷新画布: () => {
                    子模块.预览画布?.调整尺寸?.();
                    子模块.云图显示?.调整尺寸?.();
                    子模块.采集面板?.调整波形画布?.();
                }
            });
        }
    }
    
    // ========== 状态信息显示 ==========
    function 显示状态信息(图标, 文本, 详情 = '', 类型 = 'info', 持续时间 = 3000) {
        if (!elements.statusBar) return;
        
        // 设置内容
        if (elements.statusIcon) elements.statusIcon.textContent = 图标;
        if (elements.statusText) elements.statusText.textContent = 文本;
        if (elements.statusDetail) {
            elements.statusDetail.textContent = 详情;
            elements.statusDetail.style.display = 详情 ? 'block' : 'none';
        }
        
        // 设置类型样式
        elements.statusBar.className = 'field-status-bar';
        elements.statusBar.classList.add(类型);
        elements.statusBar.style.display = 'flex';
        
        // 自动隐藏
        if (持续时间 > 0) {
            setTimeout(() => {
                elements.statusBar.style.display = 'none';
            }, 持续时间);
        }
    }
    
    // ========== 实验信息更新 ==========
    function 更新实验信息显示() {
        if (!实验状态.当前实验) {
            if (elements.experimentName) elements.experimentName.textContent = '未加载实验';
            if (elements.experimentStatus) elements.experimentStatus.textContent = '--';
            if (elements.experimentProgress) elements.experimentProgress.textContent = '0/0';
            return;
        }
        
        const exp = 实验状态.当前实验;
        if (elements.experimentName) elements.experimentName.textContent = exp.name || exp.experiment_id;
        if (elements.experimentStatus) {
            const statusMap = {
                'planning': '规划中',
                'collecting': '采集中',
                'completed': '已完成'
            };
            elements.experimentStatus.textContent = statusMap[exp.status] || exp.status;
        }
        if (elements.experimentProgress) {
            const total = 实验状态.测点列表.length;
            const measured = 实验状态.已测点列表.length;
            elements.experimentProgress.textContent = `${measured}/${total}`;
        }
    }
    
    // ========== 自动保存状态更新 ==========
    function 更新自动保存状态(状态) {
        实验状态.自动保存状态 = 状态;
        if (!elements.autoSaveStatus) return;
        
        const statusMap = {
            'idle': { text: '', icon: '' },
            'saving': { text: '保存中...', icon: '💾' },
            'saved': { text: '已保存', icon: '✅' },
            'error': { text: '保存失败', icon: '❌' }
        };
        
        const info = statusMap[状态] || statusMap['idle'];
        elements.autoSaveStatus.textContent = `${info.icon} ${info.text}`;
    }
    
    // ========== 基准信息更新 ==========
    function 更新基准信息显示(baselineData) {
        const pointIdEl = document.getElementById('field-baseline-point-id');
        const timeEl = document.getElementById('field-baseline-time');
        const snrEl = document.getElementById('field-baseline-snr');
        const qualityEl = document.getElementById('field-baseline-quality');
        const statusEl = document.getElementById('field-baseline-status');
        
        if (!baselineData) {
            if (pointIdEl) pointIdEl.textContent = '--';
            if (timeEl) timeEl.textContent = '--';
            if (snrEl) snrEl.textContent = '--';
            if (qualityEl) qualityEl.textContent = '--';
            if (statusEl) {
                statusEl.textContent = '⚪ 未设置';
                statusEl.className = 'status-badge';
            }
            return;
        }
        
        if (pointIdEl) pointIdEl.textContent = `#${baselineData.point_id || baselineData.point_index || 1}`;
        if (timeEl) timeEl.textContent = baselineData.capture_time || '--';
        if (snrEl) {
            const snr = baselineData.snr;
            snrEl.textContent = snr !== undefined ? `${snr.toFixed(1)} dB` : '--';
            snrEl.className = 'value ' + (snr >= 20 ? 'good' : snr >= 10 ? 'warning' : 'bad');
        }
        if (qualityEl) {
            const quality = baselineData.quality_score;
            if (quality !== undefined) {
                const stars = quality >= 0.9 ? '★★★★★' : quality >= 0.7 ? '★★★★☆' : quality >= 0.5 ? '★★★☆☆' : '★★☆☆☆';
                qualityEl.textContent = `${(quality * 100).toFixed(0)}% ${stars}`;
                qualityEl.className = 'value ' + (quality >= 0.8 ? 'good' : quality >= 0.5 ? 'warning' : 'bad');
            } else {
                qualityEl.textContent = '--';
            }
        }
        if (statusEl) {
            statusEl.textContent = '✅ 已设置';
            statusEl.className = 'status-badge success';
        }
    }
    
    // ========== 获取质量检查模式 ==========
    function 获取质量检查模式() {
        return 质量检查模式;
    }
    
    // ========== 数据更新回调 ==========
    function 更新标定数据(data) {
        实验状态.标定数据 = data;
        显示状态信息('✅', '标定数据已加载', `K = ${data.k} MPa/ns`, 'success');
    }
    
    function 更新形状配置(config) {
        实验状态.形状配置 = config;
        // 清空测点（形状变化后需要重新生成）
        实验状态.测点列表 = [];
        实验状态.已测点列表 = [];
        刷新数据表格();
    }
    
    function 更新测点列表(points) {
        实验状态.测点列表 = points;
        实验状态.当前测点索引 = 0;
        刷新数据表格();
        更新实验信息显示();
    }
    
    function 更新测点状态(pointId, status, data) {
        // 更新测点状态
        const point = 实验状态.测点列表.find(p => p.id === pointId);
        if (point) {
            point.status = status;
            if (data) {
                point.timeDiff = data.time_diff;
                point.stress = data.stress;
                point.qualityScore = data.quality_score;
                point.snr = data.snr;
            }
        }
        
        // 更新已测点列表
        if (status === 'measured' && !实验状态.已测点列表.includes(pointId)) {
            实验状态.已测点列表.push(pointId);
        }
        
        刷新数据表格();
        更新实验信息显示();
    }
    
    // ========== 数据表格刷新 ==========
    function 刷新数据表格() {
        if (!elements.dataTableBody) return;
        
        elements.dataTableBody.innerHTML = '';
        
        if (实验状态.测点列表.length === 0) {
            elements.dataTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">暂无测点数据</td></tr>';
            return;
        }
        
        实验状态.测点列表.forEach((point, index) => {
            const row = document.createElement('tr');
            row.className = `point-row status-${point.status || 'pending'}`;
            if (index === 实验状态.当前测点索引) {
                row.classList.add('current');
            }
            
            // 状态图标
            const statusIcons = {
                'pending': '⚪',
                'measured': '🟢',
                'skipped': '🟠',
                'error': '🔴',
                'current': '🟡'
            };
            const statusIcon = index === 实验状态.当前测点索引 ? '🟡' : (statusIcons[point.status] || '⚪');
            
            row.innerHTML = `
                <td>${statusIcon} ${point.id || index + 1}</td>
                <td>${(point.x || 0).toFixed(1)}</td>
                <td>${(point.y || 0).toFixed(1)}</td>
                <td>${point.timeDiff !== undefined ? point.timeDiff.toFixed(2) : '--'}</td>
                <td>${point.stress !== undefined ? point.stress.toFixed(1) : '--'}</td>
                <td>${point.qualityScore !== undefined ? (point.qualityScore * 100).toFixed(0) + '%' : '--'}</td>
                <td>
                    <button class="btn btn-sm" onclick="StressDetectionUniaxialModule.跳转到测点(${index})" title="跳转">📍</button>
                </td>
            `;
            
            // 点击行高亮测点
            row.addEventListener('click', () => {
                子模块.预览画布?.高亮测点(point.id);
                子模块.云图显示?.高亮测点(point.id);
            });
            
            elements.dataTableBody.appendChild(row);
        });
    }

    
    // ========== 实验数据加载 ==========
    async function 加载实验数据(expId) {
        try {
            显示状态信息('⏳', '正在加载实验...', '', 'info', 0);
            
            const result = await pywebview.api.load_field_experiment(expId);
            
            if (!result.success) {
                显示状态信息('❌', '加载实验失败', result.message, 'error');
                return false;
            }
            
            const data = result.data;
            
            // 更新状态
            实验状态.当前实验 = data;
            实验状态.标定数据 = data.config_snapshot?.calibration || null;
            实验状态.形状配置 = data.shape_config || null;
            实验状态.测点列表 = data.point_layout || [];
            实验状态.已测点列表 = (data.measured_points || []).map(p => p.point_index);
            实验状态.基准点ID = data.baseline_point_id;
            实验状态.当前测点索引 = 实验状态.已测点列表.length;
            
            // 更新各面板显示
            更新实验信息显示();
            子模块.标定面板?.更新显示(实验状态.标定数据);
            子模块.形状面板?.更新显示(实验状态.形状配置);
            子模块.布点面板?.更新显示(实验状态.测点列表);
            子模块.采集面板?.更新显示();
            子模块.预览画布?.刷新();
            刷新数据表格();
            
            // 更新基准信息
            if (data.baseline_data) {
                更新基准信息显示(data.baseline_data);
            } else {
                更新基准信息显示(null);
            }
            
            // 加载云图数据
            if (实验状态.已测点列表.length >= 3) {
                await 刷新云图();
            }
            
            显示状态信息('✅', '实验加载成功', data.name, 'success');
            return true;
            
        } catch (error) {
            console.error('[应力场测绘] 加载实验失败:', error);
            显示状态信息('❌', '加载实验失败', error.toString(), 'error');
            return false;
        }
    }
    
    // ========== 清空实验数据 ==========
    function 清空实验数据() {
        实验状态.当前实验 = null;
        实验状态.标定数据 = null;
        实验状态.形状配置 = null;
        实验状态.测点列表 = [];
        实验状态.已测点列表 = [];
        实验状态.基准点ID = null;
        实验状态.当前测点索引 = 0;
        实验状态.云图数据 = null;
        
        更新实验信息显示();
        子模块.标定面板?.清空();
        子模块.形状面板?.清空();
        子模块.布点面板?.清空();
        子模块.采集面板?.清空();
        子模块.预览画布?.清空();
        子模块.云图显示?.清空();
        刷新数据表格();
    }
    
    // ========== 完成实验 ==========
    async function 完成当前实验() {
        if (!实验状态.当前实验) {
            显示状态信息('⚠️', '没有正在进行的实验', '', 'warning');
            return;
        }
        
        // 确认对话框
        const confirmed = await 显示确认对话框(
            '完成实验',
            `确定要完成实验"${实验状态.当前实验.name}"吗？\n\n完成后将无法继续采集数据。`
        );
        
        if (!confirmed) return;
        
        try {
            const result = await pywebview.api.complete_field_experiment(实验状态.当前实验.experiment_id);
            
            if (result.success) {
                实验状态.当前实验.status = 'completed';
                更新实验信息显示();
                子模块.采集面板?.禁用采集();
                显示状态信息('✅', '实验已完成', '', 'success');
            } else {
                显示状态信息('❌', '完成实验失败', result.message, 'error');
            }
        } catch (error) {
            显示状态信息('❌', '完成实验失败', error.toString(), 'error');
        }
    }
    
    // ========== 刷新云图 ==========
    async function 刷新云图() {
        if (!实验状态.当前实验) return;
        
        try {
            const result = await pywebview.api.update_field_contour(实验状态.当前实验.experiment_id);
            
            if (result.success) {
                // update_field_contour 直接返回数据，不嵌套在 data 里
                实验状态.云图数据 = result;
                子模块.云图显示?.更新数据(result);
            }
        } catch (error) {
            console.error('[应力场测绘] 刷新云图失败:', error);
        }
    }
    
    // ========== 跳转到测点 ==========
    function 跳转到测点(index) {
        if (index < 0 || index >= 实验状态.测点列表.length) return;
        
        实验状态.当前测点索引 = index;
        刷新数据表格();
        
        const point = 实验状态.测点列表[index];
        子模块.预览画布?.高亮测点(point.id);
        子模块.采集面板?.更新当前测点(index);
    }
    
    // ========== 确认对话框 ==========
    function 显示确认对话框(标题, 消息) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.style.display = 'flex';
            
            overlay.innerHTML = `
                <div class="modal-content field-modal modal-sm">
                    <div class="modal-header">
                        <h3>${标题}</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="confirm-message">${消息}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">取消</button>
                        <button class="btn btn-primary confirm-btn">确定</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            const cleanup = () => document.body.removeChild(overlay);
            
            overlay.querySelector('.modal-close').onclick = () => { cleanup(); resolve(false); };
            overlay.querySelector('.cancel-btn').onclick = () => { cleanup(); resolve(false); };
            overlay.querySelector('.confirm-btn').onclick = () => { cleanup(); resolve(true); };
            
            // ESC键取消
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', handleKeydown);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }
    
    // ========== 标签页监控 ==========
    function 启动标签页监控() {
        console.log('[应力场测绘] 标签页激活');
        
        // 调整画布尺寸
        子模块.预览画布?.调整尺寸();
        子模块.云图显示?.调整尺寸();
        子模块.采集面板?.调整波形画布();
        
        // 如果有实验正在进行，恢复监控
        if (实验状态.当前实验 && 实验状态.当前实验.status === 'collecting') {
            子模块.采集面板?.恢复监控();
        }
    }
    
    function 停止标签页监控() {
        console.log('[应力场测绘] 标签页离开');
        
        // 暂停实时监控
        子模块.采集面板?.暂停监控();
    }
    
    // ========== 获取状态 ==========
    function 获取实验状态() {
        return 实验状态;
    }
    
    function 获取当前实验() {
        return 实验状态.当前实验;
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        启动标签页监控,
        停止标签页监控,
        获取实验状态,
        获取当前实验,
        获取质量检查模式,
        跳转到测点,
        刷新云图,
        刷新数据表格,
        显示状态信息,
        显示确认对话框,
        加载实验数据,
        清空实验数据,
        更新基准信息显示
    };
})();
