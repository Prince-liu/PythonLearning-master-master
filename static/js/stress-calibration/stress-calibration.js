// ==================== 应力系数标定模块 ====================
// 功能：建立应力与声时差的关系曲线，支持多方向、实时监控、自动递增

const StressCalibrationModule = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let monitorCanvas, monitorCtx;
    let fitCanvas, fitCtx;
    
    // 实验状态
    let 实验状态 = {
        材料名称: "",
        测试方向列表: [],
        当前方向索引: 0,
        实时监控中: false,
        实时监控定时器: null
    };
    
    // DOM 元素
    let elements = {};
    
    // ========== 自定义确认对话框（模块内部使用）==========
    function 显示确认对话框(标题, 消息) {
        return new Promise((resolve) => {
            // 创建遮罩层
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
            
            // 绑定事件
            const closeBtn = overlay.querySelector('.modal-close');
            const cancelBtn = overlay.querySelector('.cancel-btn');
            const confirmBtn = overlay.querySelector('.confirm-btn');
            
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            
            closeBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            confirmBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
            
            // 支持 ESC 键取消
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
    
    // ========== 初始化函数 ==========
    function 初始化() {
        // 获取 Canvas
        monitorCanvas = document.getElementById('sd-monitorCanvas');
        monitorCtx = monitorCanvas.getContext('2d');
        fitCanvas = document.getElementById('sd-fitCanvas');
        fitCtx = fitCanvas.getContext('2d');
        
        // 获取所有 DOM 元素
        elements = {
            materialName: document.getElementById('sd-materialName'),
            addDirectionBtn: document.getElementById('sd-addDirectionBtn'),
            manageExperimentsBtn: document.getElementById('sd-manageExperimentsBtn'),
            directionTabs: document.getElementById('sd-directionTabs'),
            paramTitle: document.getElementById('sd-paramTitle'),
            captureTitle: document.getElementById('sd-captureTitle'),
            analysisTitle: document.getElementById('sd-analysisTitle'),
            stressMin: document.getElementById('sd-stressMin'),
            stressMax: document.getElementById('sd-stressMax'),
            stressStep: document.getElementById('sd-stressStep'),
            toggleExperimentBtn: document.getElementById('sd-toggleExperimentBtn'),
            captureBaselineBtn: document.getElementById('sd-captureBaselineBtn'),
            currentStress: document.getElementById('sd-currentStress'),
            captureWaveformBtn: document.getElementById('sd-captureWaveformBtn'),
            endCaptureBtn: document.getElementById('sd-endCaptureBtn'),
            resetExperimentBtn: document.getElementById('sd-resetExperimentBtn'),
            exportDataBtn: document.getElementById('sd-exportDataBtn'),
            startMonitorBtn: document.getElementById('sd-startMonitorBtn'),
            stopMonitorBtn: document.getElementById('sd-stopMonitorBtn'),
            monitorStatus: document.getElementById('sd-monitorStatus'),
            monitorMessage: document.getElementById('sd-monitorMessage'),
            tableTitle: document.getElementById('sd-tableTitle'),
            dataTableBody: document.getElementById('sd-dataTableBody'),
            fitEquation: document.getElementById('sd-fitEquation'),
            fitMessage: document.getElementById('sd-fitMessage'),
            experimentManagerModal: document.getElementById('experimentManagerModal'),
            experimentListContainer: document.getElementById('experimentListContainer'),
            // 🆕 状态栏信息面板
            statusBarInfoPanel: document.getElementById('sd-statusBarInfoPanel'),
            statusBarInfoIcon: document.getElementById('sd-statusBarInfoIcon'),
            statusBarInfoText: document.getElementById('sd-statusBarInfoText'),
            statusBarInfoDetail: document.getElementById('sd-statusBarInfoDetail')
        };
        
        // 绑定事件
        绑定事件();
        
        // 初始化 Canvas 尺寸
        调整监控画布();
        调整拟合画布();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            调整监控画布();
            调整拟合画布();
        });
        
        // 初始化数据管理模块
        StressCalibrationManager.初始化(实验状态, elements, {
            fitCanvas,
            fitCtx
        }, {
            显示状态栏信息,
            显示确认对话框,
            更新方向选择器,
            加载当前方向配置,
            更新按钮状态
        });
        
        // 初始化数据采集模块
        StressCalibrationCapture.初始化(实验状态, elements, {
            monitorCanvas,
            monitorCtx
        }, {
            显示状态栏信息,
            显示确认对话框,
            刷新数据表格: () => StressCalibrationManager.刷新数据表格(),
            更新按钮状态,
            更新方向选择器
        });
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        elements.addDirectionBtn.addEventListener('click', 添加测试方向);
        elements.toggleExperimentBtn.addEventListener('click', 切换实验状态);
        elements.captureBaselineBtn.addEventListener('click', 采集基准波形);
        elements.captureWaveformBtn.addEventListener('click', 采集应力波形);
        elements.endCaptureBtn.addEventListener('click', 采集结束);
        elements.resetExperimentBtn.addEventListener('click', 重置当前方向实验);
        elements.exportDataBtn.addEventListener('click', () => StressCalibrationManager.导出当前方向CSV());
        elements.startMonitorBtn.addEventListener('click', () => StressCalibrationCapture.手动开始监控());
        elements.stopMonitorBtn.addEventListener('click', () => StressCalibrationCapture.手动停止监控());
        elements.manageExperimentsBtn.addEventListener('click', () => StressCalibrationManager.打开实验管理对话框());
        
        // 🆕 信号处理设置按钮
        const denoiseSettingsBtn = document.getElementById('sd-denoise-settings');
        if (denoiseSettingsBtn) {
            denoiseSettingsBtn.addEventListener('click', 打开信号处理设置);
        }
        
        // 🆕 监听参数输入框变化，同步更新到当前方向对象
        elements.stressMin.addEventListener('change', 同步参数到当前方向);
        elements.stressMax.addEventListener('change', 同步参数到当前方向);
        elements.stressStep.addEventListener('change', 同步参数到当前方向);
    }
    
    // 🆕 同步参数到当前方向对象
    function 同步参数到当前方向() {
        if (实验状态.测试方向列表.length === 0) return;
        
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 更新方向对象中的参数
        当前方向.应力范围[0] = parseFloat(elements.stressMin.value);
        当前方向.应力范围[1] = parseFloat(elements.stressMax.value);
        当前方向.应力步长 = parseFloat(elements.stressStep.value);
    }
    
    // ========== 方向管理 ==========
    async function 添加测试方向() {
        // 🆕 必须先输入材料名称
        const 材料名称 = elements.materialName.value.trim();
        if (!材料名称) {
            显示状态栏信息('⚠️', '请先输入材料名称', '', 'warning', 3000);
            elements.materialName.focus();
            return;
        }
        
        const 方向描述 = await CommonUtils.customPrompt(
            "请输入测试方向描述（例如: 0°、45°、纵向、横向、试件1-0度等）",
            "",
            "添加测试方向"
        );
        
        if (!方向描述 || 方向描述.trim() === "") {
            显示状态栏信息('❌', '方向描述不能为空', '', 'warning', 3000);
            return;
        }
        
        // 检查当前打开的标签中是否重复
        const 当前已存在 = 实验状态.测试方向列表.some(d => d.方向名称 === 方向描述.trim());
        if (当前已存在) {
            显示状态栏信息('❌', `方向"${方向描述}"已在当前标签中存在`, '', 'warning', 3000);
            return;
        }
        
        // 检查数据库中是否已存在（针对同一材料）
        try {
            const result = await pywebview.api.检查方向是否存在(材料名称, 方向描述.trim());
            if (result.success && result.exists) {
                显示状态栏信息('❌', `材料"${材料名称}"的方向"${方向描述}"已存在于数据库中，请使用不同的名称（如"${方向描述}-2"）`, '', 'warning', 5000);
                return;
            }
        } catch (error) {
            // 检查失败不阻止添加，只记录错误
        }
        
        // 添加新方向
        实验状态.测试方向列表.push({
            方向名称: 方向描述.trim(),
            应力范围: [
                parseFloat(elements.stressMin.value),
                parseFloat(elements.stressMax.value)
            ],
            应力步长: parseFloat(elements.stressStep.value),
            基准波形路径: null,
            应力数据: [],
            拟合结果: null,
            // 🆕 每个方向独立的状态
            实验ID: null,        // 该方向的实验ID
            实验已开始: false,   // 是否点击过"开始实验"
            实验已暂停: false,   // 是否点击过"暂停实验"
            采集已结束: false    // 是否点击过"采集结束"
        });
        
        // 切换到新添加的方向
        实验状态.当前方向索引 = 实验状态.测试方向列表.length - 1;
        
        更新方向选择器();
        加载当前方向配置();
        StressCalibrationManager.刷新数据表格();
        
        显示状态栏信息('✅', `测试方向已添加：${方向描述}`, '', 'success', 3000);
    }
    
    function 更新方向选择器() {
        // 🆕 更新方向标签页
        elements.directionTabs.innerHTML = '';
        
        if (实验状态.测试方向列表.length === 0) {
            elements.directionTabs.style.display = 'none';
            return;
        }
        
        elements.directionTabs.style.display = 'flex';
        
        实验状态.测试方向列表.forEach((方向, index) => {
            const tab = document.createElement('div');
            tab.className = 'direction-tab';
            if (index === 实验状态.当前方向索引) {
                tab.classList.add('active');
            }
            
            // 状态图标
            let 状态图标 = '⚪';  // 未开始
            if (方向.拟合结果) {
                状态图标 = '✅';  // 已完成
            } else if (方向.应力数据.length > 0 || 方向.基准波形路径) {
                状态图标 = '⏳';  // 进行中
            }
            
            tab.innerHTML = `
                <span class="direction-tab-status">${状态图标}</span>
                <span class="direction-tab-name">${方向.方向名称}</span>
                <button class="direction-tab-delete" title="删除方向">×</button>
            `;
            
            // 点击标签切换方向
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('direction-tab-delete')) {
                    切换到方向(index);
                }
            });
            
            // 删除按钮
            const deleteBtn = tab.querySelector('.direction-tab-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                删除测试方向(index);
            });
            
            elements.directionTabs.appendChild(tab);
        });
    }
    
    function 切换到方向(index) {
        if (index === 实验状态.当前方向索引) return;
        
        实验状态.当前方向索引 = index;
        更新方向选择器();
        加载当前方向配置();
        StressCalibrationManager.刷新数据表格();
        StressCalibrationManager.绘制拟合曲线图();
    }
    
    function 删除测试方向(index) {
        const 方向 = 实验状态.测试方向列表[index];
        const 方向名称 = 方向.方向名称;
        
        // 只是关闭标签页，不删除任何数据
        实验状态.测试方向列表.splice(index, 1);
        
        // 调整当前索引
        if (实验状态.测试方向列表.length === 0) {
            实验状态.当前方向索引 = 0;
        } else if (实验状态.当前方向索引 >= 实验状态.测试方向列表.length) {
            实验状态.当前方向索引 = 实验状态.测试方向列表.length - 1;
        }
        
        更新方向选择器();
        加载当前方向配置();
        StressCalibrationManager.刷新数据表格();
        StressCalibrationManager.绘制拟合曲线图();
        
        显示状态栏信息('ℹ️', `标签"${方向名称}"已关闭`, '', 'info', 3000);
    }
    
    function 加载当前方向配置() {
        if (实验状态.测试方向列表.length === 0) {
            // 清空所有显示
            elements.paramTitle.textContent = '⚙️ 实验参数';
            elements.captureTitle.textContent = '📸 数据采集';
            elements.analysisTitle.textContent = '📊 数据分析';
            elements.tableTitle.textContent = '测试方向: --';
            return;
        }
        
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 🆕 更新材料名称（如果方向有材料名称，则更新输入框）
        if (当前方向.材料名称) {
            elements.materialName.value = 当前方向.材料名称;
            实验状态.材料名称 = 当前方向.材料名称;
        }
        
        // 🆕 更新所有标题，显示当前方向（使用HTML添加徽章样式）
        elements.paramTitle.innerHTML = `⚙️ 实验参数 - <span class="direction-badge">${当前方向.方向名称}</span>`;
        elements.captureTitle.innerHTML = `📸 数据采集 - <span class="direction-badge">${当前方向.方向名称}</span>`;
        elements.analysisTitle.innerHTML = `📊 数据分析 - <span class="direction-badge">${当前方向.方向名称}</span>`;
        elements.tableTitle.innerHTML = `测试方向: <span class="direction-badge">${当前方向.方向名称}</span>`;
        
        // 加载参数
        elements.stressMin.value = 当前方向.应力范围[0];
        elements.stressMax.value = 当前方向.应力范围[1];
        elements.stressStep.value = 当前方向.应力步长;
        
        // 🆕 更新拟合公式显示
        if (当前方向.拟合结果) {
            const 斜率 = (当前方向.拟合结果.斜率 * 1e9).toFixed(3);
            const 截距 = (当前方向.拟合结果.截距 * 1e9).toFixed(3);
            const R方 = 当前方向.拟合结果.R方.toFixed(4);
            elements.fitEquation.textContent = `Δt = ${斜率}σ + ${截距} (R²=${R方})`;
        } else {
            elements.fitEquation.textContent = '暂无拟合结果';
        }
        
        // 🆕 根据方向状态更新按钮状态
        更新按钮状态();
    }
    
    function 更新按钮状态() {
        if (实验状态.测试方向列表.length === 0) return;
        
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 根据当前方向的状态，智能更新所有按钮
        if (当前方向.采集已结束) {
            // 情况1：该方向已完成采集 → 按钮禁用，重置按钮启用
            elements.toggleExperimentBtn.disabled = true;
            elements.toggleExperimentBtn.textContent = "▶️ 开始实验";
            elements.toggleExperimentBtn.className = "btn btn-primary btn-block";
            elements.captureBaselineBtn.disabled = true;
            elements.captureWaveformBtn.disabled = true;
            elements.endCaptureBtn.disabled = true;
            elements.endCaptureBtn.className = "btn btn-secondary btn-block"; // 变成灰色
            elements.resetExperimentBtn.disabled = false;
        } else if (当前方向.实验已暂停) {
            // 情况2：该方向已暂停 → 显示继续按钮（绿色）
            elements.toggleExperimentBtn.disabled = false;
            elements.toggleExperimentBtn.textContent = "▶️ 继续实验";
            elements.toggleExperimentBtn.className = "btn btn-success btn-block";
            elements.captureBaselineBtn.disabled = true;
            elements.captureWaveformBtn.disabled = true;
            elements.endCaptureBtn.disabled = false;
            elements.resetExperimentBtn.disabled = true;
        } else if (当前方向.实验已开始) {
            // 情况3：该方向正在进行中 → 显示暂停按钮（橙色）
            elements.toggleExperimentBtn.disabled = false;
            elements.toggleExperimentBtn.textContent = "⏸️ 暂停实验";
            elements.toggleExperimentBtn.className = "btn btn-warning btn-block";
            elements.captureBaselineBtn.disabled = false;
            elements.endCaptureBtn.disabled = false;
            elements.resetExperimentBtn.disabled = true;
            // 采集波形按钮根据是否有基准波形决定
            if (当前方向.基准波形路径) {
                elements.captureWaveformBtn.disabled = false;
            } else {
                elements.captureWaveformBtn.disabled = true;
            }
        } else {
            // 情况4：该方向从未开始 → 显示开始按钮（蓝色）
            elements.toggleExperimentBtn.disabled = false;
            elements.toggleExperimentBtn.textContent = "▶️ 开始实验";
            elements.toggleExperimentBtn.className = "btn btn-primary btn-block";
            elements.captureBaselineBtn.disabled = true;
            elements.captureWaveformBtn.disabled = true;
            elements.endCaptureBtn.disabled = true;
            elements.resetExperimentBtn.disabled = true;
        }
        
        // 根据是否有拟合结果或数据，启用/禁用导出按钮
        if (当前方向.拟合结果 || 当前方向.应力数据.length > 0) {
            elements.exportDataBtn.disabled = false;
        } else {
            elements.exportDataBtn.disabled = true;
        }
    }

    
    // ========== 实验控制 ==========
    async function 切换实验状态() {
        // 边界检查：确保有测试方向
        if (实验状态.测试方向列表.length === 0) {
            显示状态栏信息('⚠️', '请先添加测试方向', '', 'warning', 3000);
            return;
        }
        
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 情况1：实验正在运行 → 暂停
        if (当前方向.实验已开始 && !当前方向.实验已暂停) {
            当前方向.实验已暂停 = true;
            停止实时监控();
            更新按钮状态();
            更新方向选择器();
            显示状态栏信息('⏸️', `实验已暂停：${当前方向.方向名称}`, '', 'info', 3000);
            return;
        }
        
        // 情况2：实验已暂停 → 继续
        if (当前方向.实验已暂停) {
            当前方向.实验已暂停 = false;
            开始实时监控();
            更新按钮状态();
            更新方向选择器();
            显示状态栏信息('✅', `继续实验：${当前方向.方向名称}`, '', 'success', 3000);
            return;
        }
        
        // 情况3：首次开始实验
        // 验证输入
        const 材料名称 = elements.materialName.value.trim();
        if (!材料名称) {
            显示状态栏信息('⚠️', '请输入材料名称', '', 'warning', 3000);
            elements.materialName.focus();
            return;
        }
        
        if (实验状态.测试方向列表.length === 0) {
            显示状态栏信息('⚠️', '请至少添加一个测试方向', '', 'warning', 3000);
            return;
        }
        
        // 检查示波器连接
        if (!RealtimeCapture.获取连接状态()) {
            显示状态栏信息('⚠️', '请先连接示波器', '', 'warning', 3000);
            return;
        }
        
        try {
            // 为当前方向创建实验
            const result = await pywebview.api.创建应力检测实验(
                材料名称,
                [当前方向]
            );
            
            if (!result.success) {
                alert("❌ 创建实验失败: " + result.message);
                return;
            }
            
            // 保存实验ID到当前方向
            当前方向.实验ID = result.data.实验ID;
            当前方向.实验已开始 = true;
            当前方向.实验已暂停 = false;
            实验状态.材料名称 = 材料名称;
            
            // 启动实时监控
            开始实时监控();
            
            // 只禁用材料名称输入框（保持材料一致性），允许添加新方向
            elements.materialName.disabled = true;
            
            // 更新按钮状态
            更新按钮状态();
            更新方向选择器();
            
            显示状态栏信息('✅', `实验已开始：${当前方向.方向名称}（ID: ${当前方向.实验ID}）`, '', 'success', 3000);
        } catch (error) {
            alert("❌ 开始实验失败: " + error);
        }
    }
    
    async function 采集结束() {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 🆕 标记当前方向为已结束
        当前方向.采集已结束 = true;
        
        停止实时监控();
        更新按钮状态();
        更新方向选择器();
        
        // 🆕 自动绘制拟合曲线
        if (当前方向.应力数据.length >= 2) {
            // 数据点足够，自动绘制拟合曲线
            await StressCalibrationManager.绘制拟合曲线();
        } else {
            // 数据点不足，显示错误消息
            显示状态栏信息('⚠️', '数据点不足，至少需要2个点', '无法绘制拟合曲线', 'warning', 5000);
        }
        
        // 🆕 检查是否所有方向都已完成
        const 所有方向已完成 = 实验状态.测试方向列表.every(方向 => 方向.采集已结束);
        
        if (所有方向已完成) {
            // 所有方向都完成了，可以修改材料名称
            elements.materialName.disabled = false;
        }
        
        显示状态栏信息('✅', `方向"${当前方向.方向名称}"采集已结束`, '', 'info', 3000);
    }
    
    async function 重置当前方向实验() {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 显示自定义确认对话框
        const 确认 = await 显示确认对话框(
            '⚠️ 重置实验',
            `确定要重置方向"${当前方向.方向名称}"的实验吗？\n\n此操作将：\n- 清除所有已采集的应力数据\n- 清除基准波形\n- 清除拟合结果\n- 删除数据库中的数据\n\n重置后可以重新开始该方向的实验。`
        );
        
        if (!确认) return;
        
        try {
            // 调用后端清除数据库数据
            const result = await pywebview.api.重置方向数据(当前方向.实验ID, 当前方向.方向名称);
            
            if (result.success) {
                // 清除前端数据
                当前方向.应力数据 = [];
                当前方向.基准波形路径 = null;
                当前方向.拟合结果 = null;
                当前方向.实验已开始 = false;
                当前方向.实验已暂停 = false;
                当前方向.采集已结束 = false;
                
                // 重置当前应力点
                elements.currentStress.value = 当前方向.应力范围[0];
                
                // 清空拟合公式显示
                elements.fitEquation.textContent = '--';
                
                // 刷新界面
                StressCalibrationManager.刷新数据表格();
                StressCalibrationManager.绘制拟合曲线图();
                更新按钮状态();
                更新方向选择器();
                
                显示状态栏信息('✅', `方向"${当前方向.方向名称}"已重置，可以重新开始实验`, '', 'success', 3000);
            } else {
                显示状态栏信息('❌', `重置失败：${result.message}`, '', 'warning', 3000);
            }
        } catch (error) {
            显示状态栏信息('❌', `重置失败：${error.toString()}`, '', 'warning', 3000);
        }
    }
    
    // ========== 实时监控和波形采集（已移至 stress-calibration-capture.js）==========
    // 以下函数已移至数据采集模块，通过 StressCalibrationCapture 调用
    
    function 开始实时监控() {
        StressCalibrationCapture.开始实时监控();
    }
    
    function 停止实时监控() {
        StressCalibrationCapture.停止实时监控();
    }
    
    function 采集基准波形() {
        StressCalibrationCapture.采集基准波形();
    }
    
    function 采集应力波形() {
        StressCalibrationCapture.采集应力波形();
    }
    
    // ========== 数据表格、拟合曲线、数据导出（已移至 Manager 模块）==========
    // 委托给 StressCalibrationManager
    function 删除数据点(index) {
        StressCalibrationManager.删除数据点(index);
    }
    
    // ========== 实验数据管理（已移至 stress-calibration-manager.js）==========
    // 以下函数已移至数据管理模块，通过 StressCalibrationManager 调用
    
    // ========== 状态栏信息显示 ==========
    function 显示状态栏信息(图标, 主文本, 详细文本 = '', 类型 = 'success', 持续时间 = 3000) {
        // 设置图标和文本
        elements.statusBarInfoIcon.textContent = 图标;
        elements.statusBarInfoText.textContent = 主文本;
        
        // 设置详细信息（如果有）
        if (详细文本) {
            elements.statusBarInfoDetail.textContent = 详细文本;
            elements.statusBarInfoDetail.style.display = 'block';
        } else {
            elements.statusBarInfoDetail.style.display = 'none';
        }
        
        // 移除所有类型类
        elements.statusBarInfoPanel.classList.remove('success', 'info', 'warning');
        
        // 添加对应类型的类
        elements.statusBarInfoPanel.classList.add(类型);
        
        // 显示面板
        elements.statusBarInfoPanel.style.display = 'flex';
        
        // 指定时间后自动隐藏
        setTimeout(() => {
            elements.statusBarInfoPanel.style.display = 'none';
        }, 持续时间);
    }
    
    // ========== Canvas 调整 ==========
    function 调整监控画布() {
        StressCalibrationCapture.调整监控画布();
    }
    
    function 调整拟合画布() {
        StressCalibrationManager.调整拟合画布();
    }
    
    // ========== 标签页监控 ==========
    function 启动标签页监控() {
        // 调整 Canvas 尺寸
        StressCalibrationCapture.调整监控画布();
        // 不再自动启动监控，由用户手动点击按钮
    }
    
    function 停止标签页监控() {
        // 离开标签页时，停止监控
        StressCalibrationCapture.停止实时监控();
    }
    
    // ========== 信号处理设置 ==========
    async function 打开信号处理设置() {
        // 先从后端获取当前配置
        let currentConfig = {
            denoise: {
                method: 'wavelet',
                wavelet: 'sym6',
                level: 5,
                threshold_mode: 'soft'
            },
            bandpass: {
                lowcut: 1.5,
                highcut: 3.5,
                order: 6
            }
        };
        
        try {
            const denoiseResult = await pywebview.api.get_denoise_config();
            if (denoiseResult.success && denoiseResult.data) {
                currentConfig.denoise = denoiseResult.data;
            }
            
            const bandpassResult = await pywebview.api.get_bandpass_config();
            if (bandpassResult.success && bandpassResult.data) {
                currentConfig.bandpass = bandpassResult.data;
            }
        } catch (error) {
            console.log('获取配置失败，使用默认值');
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'sd-signal-processing-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-sm">
                <div class="modal-header">
                    <h3>🔧 信号处理设置</h3>
                    <button class="modal-close" onclick="document.getElementById('sd-signal-processing-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section">
                        <div class="form-section-title">
                            <span class="section-icon">📉</span>
                            <span>降噪参数</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>降噪方法</label>
                                <select id="sd-denoise-method" class="form-input">
                                    <option value="wavelet" ${currentConfig.denoise.method === 'wavelet' ? 'selected' : ''}>小波降噪</option>
                                    <option value="savgol" ${currentConfig.denoise.method === 'savgol' ? 'selected' : ''}>Savitzky-Golay滤波</option>
                                    <option value="none" ${currentConfig.denoise.method === 'none' ? 'selected' : ''}>不降噪</option>
                                </select>
                            </div>
                            <div id="sd-denoise-wavelet-params">
                                <div class="form-group">
                                    <label>小波基</label>
                                    <select id="sd-denoise-wavelet" class="form-input">
                                        <option value="sym6" ${currentConfig.denoise.wavelet === 'sym6' ? 'selected' : ''}>sym6</option>
                                        <option value="db4" ${currentConfig.denoise.wavelet === 'db4' ? 'selected' : ''}>db4</option>
                                        <option value="coif3" ${currentConfig.denoise.wavelet === 'coif3' ? 'selected' : ''}>coif3</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>分解层数</label>
                                    <input type="number" id="sd-denoise-level" class="form-input" value="${currentConfig.denoise.level}" min="1" max="10">
                                </div>
                                <div class="form-group">
                                    <label>阈值模式</label>
                                    <select id="sd-denoise-threshold-mode" class="form-input">
                                        <option value="soft" ${currentConfig.denoise.threshold_mode === 'soft' ? 'selected' : ''}>软阈值</option>
                                        <option value="hard" ${currentConfig.denoise.threshold_mode === 'hard' ? 'selected' : ''}>硬阈值</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section" style="margin-top: 15px;">
                        <div class="form-section-title">
                            <span class="section-icon">🎛️</span>
                            <span>带通滤波参数</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>低频截止 (MHz)</label>
                                <input type="number" id="sd-bandpass-lowcut" class="form-input" value="${currentConfig.bandpass.lowcut}" min="1" max="6" step="0.1">
                                <small style="color: #666; font-size: 11px;">范围: 1-6 MHz</small>
                            </div>
                            <div class="form-group">
                                <label>高频截止 (MHz)</label>
                                <input type="number" id="sd-bandpass-highcut" class="form-input" value="${currentConfig.bandpass.highcut}" min="1" max="6" step="0.1">
                                <small style="color: #666; font-size: 11px;">范围: 1-6 MHz</small>
                            </div>
                            <div class="form-group">
                                <label>滤波器阶数</label>
                                <select id="sd-bandpass-order" class="form-input">
                                    <option value="2" ${currentConfig.bandpass.order === 2 ? 'selected' : ''}>2阶</option>
                                    <option value="4" ${currentConfig.bandpass.order === 4 ? 'selected' : ''}>4阶</option>
                                    <option value="6" ${currentConfig.bandpass.order === 6 ? 'selected' : ''}>6阶（推荐）</option>
                                    <option value="8" ${currentConfig.bandpass.order === 8 ? 'selected' : ''}>8阶</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('sd-signal-processing-modal').remove()">取消</button>
                    <button class="btn btn-primary" onclick="StressCalibrationModule.保存信号处理设置()">保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    function 保存信号处理设置() {
        // 保存降噪设置
        const method = document.getElementById('sd-denoise-method')?.value || 'wavelet';
        const wavelet = document.getElementById('sd-denoise-wavelet')?.value || 'sym6';
        const level = parseInt(document.getElementById('sd-denoise-level')?.value) || 5;
        const thresholdMode = document.getElementById('sd-denoise-threshold-mode')?.value || 'soft';
        
        // 保存带通滤波设置
        const lowcut = parseFloat(document.getElementById('sd-bandpass-lowcut')?.value) || 1.5;
        const highcut = parseFloat(document.getElementById('sd-bandpass-highcut')?.value) || 3.5;
        const order = parseInt(document.getElementById('sd-bandpass-order')?.value) || 6;
        
        // 验证参数
        if (lowcut >= highcut) {
            显示状态栏信息('⚠️', '参数错误', '低频截止必须小于高频截止', 'warning');
            return;
        }
        
        if (lowcut < 1 || lowcut > 6 || highcut < 1 || highcut > 6) {
            显示状态栏信息('⚠️', '参数错误', '频率范围必须在 1-6 MHz 之间', 'warning');
            return;
        }
        
        // 调用后端API保存配置
        (async () => {
            try {
                // 保存到本地状态
                if (!实验状态.信号处理配置) {
                    实验状态.信号处理配置 = {};
                }
                
                const denoiseEnabled = document.getElementById('sd-auto-denoise')?.checked ?? true;
                const bandpassEnabled = document.getElementById('sd-bandpass-filter')?.checked ?? true;
                
                实验状态.信号处理配置.降噪 = {
                    enabled: denoiseEnabled,
                    method: method,
                    wavelet: wavelet,
                    level: level,
                    thresholdMode: thresholdMode
                };
                
                实验状态.信号处理配置.带通滤波 = {
                    enabled: bandpassEnabled,
                    lowcut: lowcut,
                    highcut: highcut,
                    order: order
                };
                
                // 保存降噪配置到后端
                await pywebview.api.set_denoise_config({
                    enabled: denoiseEnabled,
                    method: method,
                    wavelet: wavelet,
                    level: level,
                    threshold_mode: thresholdMode
                });
                
                // 保存带通滤波配置到后端
                await pywebview.api.set_bandpass_config({
                    enabled: bandpassEnabled,
                    lowcut: lowcut,
                    highcut: highcut,
                    order: order
                });
                
                document.getElementById('sd-signal-processing-modal')?.remove();
                显示状态栏信息('✅', '信号处理设置已保存', 
                    `带通滤波: ${lowcut}-${highcut} MHz`, 'success');
            } catch (error) {
                显示状态栏信息('❌', '保存失败', error.toString(), 'error');
            }
        })();
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        删除测试方向,  // 暴露给HTML onclick使用
        删除数据点,    // 暴露给HTML onclick使用
        保存信号处理设置,  // 🆕 暴露给设置弹窗使用
        // 以下函数委托给数据管理模块
        删除方向: (实验ID, 方向ID, 方向名称) => StressCalibrationManager.删除方向(实验ID, 方向ID, 方向名称),
        删除全部数据: () => StressCalibrationManager.删除全部数据(),
        导出方向数据: (实验ID, 方向ID) => StressCalibrationManager.导出方向数据(实验ID, 方向ID),
        导出全部数据: () => StressCalibrationManager.导出全部数据(),
        加载实验方向: (实验ID) => StressCalibrationManager.加载实验方向(实验ID),
        关闭实验管理对话框: () => StressCalibrationManager.关闭实验管理对话框(),
        获取实验状态: () => 实验状态,
        启动标签页监控,  // 标签页切换时调用
        停止标签页监控   // 离开标签页时调用
    };
})();
