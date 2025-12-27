// ==================== 应力系数标定 - 数据管理模块 ====================
// 功能：实验历史管理、数据导出、删除操作
// 依赖：主模块的状态和 DOM 元素

const StressCalibrationManager = (function() {
    'use strict';
    
    // ========== 私有变量（从主模块传入）==========
    let 实验状态;
    let elements;
    let fitCanvas, fitCtx;
    let 显示状态栏信息;
    let 显示确认对话框;
    let 更新方向选择器;
    let 加载当前方向配置;
    let 更新按钮状态;
    
    // ========== 初始化函数 ==========
    function 初始化(状态, DOM元素, Canvas对象, 工具函数) {
        实验状态 = 状态;
        elements = DOM元素;
        fitCanvas = Canvas对象.fitCanvas;
        fitCtx = Canvas对象.fitCtx;
        显示状态栏信息 = 工具函数.显示状态栏信息;
        显示确认对话框 = 工具函数.显示确认对话框;
        更新方向选择器 = 工具函数.更新方向选择器;
        加载当前方向配置 = 工具函数.加载当前方向配置;
        更新按钮状态 = 工具函数.更新按钮状态;
    }
    
    // ========== 实验管理对话框 ==========
    async function 打开实验管理对话框() {
        try {
            // 显示对话框
            elements.experimentManagerModal.style.display = 'flex';
            
            // 显示加载中
            elements.experimentListContainer.innerHTML = '<p style="text-align: center; color: #999;">加载中...</p>';
            
            // 调用后端获取方向列表（扁平化结构）
            const result = await pywebview.api.获取所有方向列表();
            
            if (!result.success) {
                elements.experimentListContainer.innerHTML = `<p style="text-align: center; color: #ef4444;">❌ ${result.message}</p>`;
                return;
            }
            
            const 方向列表 = result.data;
            
            if (方向列表.length === 0) {
                elements.experimentListContainer.innerHTML = '<p style="text-align: center; color: #999;">暂无实验数据</p>';
                return;
            }
            
            // 生成方向列表HTML
            let html = '';
            方向列表.forEach(方向 => {
                const 创建时间 = new Date(方向.创建时间).toLocaleString('zh-CN');
                
                // 构建标题：EXP001 - 材料名称 - 方向名称
                const 标题 = `<strong>EXP${String(方向.实验ID).padStart(3, '0')}</strong> - ${方向.材料名称} - ${方向.方向名称}`;
                
                html += `
                    <div class="experiment-item" ondblclick="StressCalibrationModule.加载实验方向(${方向.实验ID})" style="cursor: pointer;">
                        <div class="experiment-info">
                            <div class="experiment-title">
                                ${标题}
                            </div>
                            <div class="experiment-meta">
                                <span>📅 ${创建时间}</span>
                                <span>📈 ${方向.数据点数} 个数据点</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); StressCalibrationModule.加载实验方向(${方向.实验ID})">
                                📂 加载
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); StressCalibrationModule.导出方向数据(${方向.实验ID}, ${方向.方向ID})">
                                📊 导出
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); StressCalibrationModule.删除方向(${方向.实验ID}, ${方向.方向ID}, '${方向.方向名称}')">
                                🗑️ 删除
                            </button>
                        </div>
                    </div>
                `;
            });
            
            elements.experimentListContainer.innerHTML = html;
        } catch (error) {
            elements.experimentListContainer.innerHTML = `<p style="text-align: center; color: #ef4444;">❌ 加载失败: ${error}</p>`;
        }
    }
    
    function 关闭实验管理对话框() {
        elements.experimentManagerModal.style.display = 'none';
    }
    
    // ========== 加载历史实验 ==========
    async function 加载实验方向(实验ID) {
        // 检查是否已经加载过该实验
        const 已存在 = 实验状态.测试方向列表.some(方向 => 方向.实验ID === 实验ID);
        if (已存在) {
            显示状态栏信息('ℹ️', '该实验已在前台', '', 'info', 2000);
            return;
        }
        
        try {
            // 调用后端加载完整实验数据
            const result = await pywebview.api.加载实验完整数据(实验ID);
            
            if (!result.success) {
                显示状态栏信息('❌', `加载失败：${result.message}`, '', 'warning', 3000);
                return;
            }
            
            const 实验数据 = result.data;
            
            // 追加模式：将历史方向追加到现有列表
            实验数据.测试方向列表.forEach(方向 => {
                // 转换数据格式，适配前端结构
                const 新方向 = {
                    方向名称: 方向.方向名称,
                    材料名称: 实验数据.材料名称,
                    实验ID: 实验数据.实验ID,
                    方向ID: 方向.方向ID,
                    应力范围: 方向.应力范围,
                    应力步长: 方向.应力步长,
                    基准波形路径: 方向.基准波形路径,
                    应力数据: 方向.应力数据,
                    拟合结果: 方向.拟合结果,
                    // 历史数据标记为已完成，但可以重置后重新实验
                    实验已开始: true,
                    实验已暂停: false,
                    采集已结束: true,
                    // 🆕 重测状态（加载历史数据时初始化为关闭）
                    重测状态: {
                        启用: false,
                        重测应力值: null,
                        返回应力值: null
                    }
                };
                
                实验状态.测试方向列表.push(新方向);
            });
            
            // 如果当前没有材料名称，设置为加载的材料名称
            if (!elements.materialName.value.trim()) {
                elements.materialName.value = 实验数据.材料名称;
                实验状态.材料名称 = 实验数据.材料名称;
            }
            
            // 🆕 记录加载前的标签数量
            const 加载前标签数量 = 实验状态.测试方向列表.length - 实验数据.测试方向列表.length;
            
            // 更新界面
            更新方向选择器();
            
            // 🆕 只有在加载前没有标签时，才切换到新加载的方向
            if (加载前标签数量 === 0) {
                // 没有标签，切换到第一个加载的方向
                实验状态.当前方向索引 = 0;
                加载当前方向配置();
                刷新数据表格();
                
                // 先调整画布尺寸，再绘制拟合曲线
                调整拟合画布();
                绘制拟合曲线图();
                
                // 🆕 加载信号处理配置（从第一个方向的HDF5文件恢复）
                const 第一个方向 = 实验数据.测试方向列表[0];
                if (第一个方向 && 第一个方向.基准波形路径) {
                    try {
                        const configResult = await pywebview.api.加载标定实验配置(
                            实验数据.实验ID, 
                            第一个方向.方向名称
                        );
                        if (configResult.success && configResult.data) {
                            // 更新前端状态
                            if (!实验状态.信号处理配置) {
                                实验状态.信号处理配置 = {};
                            }
                            if (configResult.data.denoise_config) {
                                实验状态.信号处理配置.降噪 = configResult.data.denoise_config;
                            }
                            if (configResult.data.bandpass_config) {
                                实验状态.信号处理配置.带通滤波 = configResult.data.bandpass_config;
                            }
                        }
                    } catch (e) {
                        // 配置加载失败不影响主流程，使用默认配置
                        console.warn('加载信号处理配置失败:', e);
                    }
                }
            }
            // 如果已有标签，保持当前方向不变，只更新标签选择器
            
            // 关闭对话框
            关闭实验管理对话框();
            
            显示状态栏信息('✅', `已加载实验：${实验数据.材料名称}（${实验数据.测试方向列表.length}个方向）`, '', 'success', 3000);
        } catch (error) {
            显示状态栏信息('❌', `加载失败：${error.toString()}`, '', 'warning', 3000);
        }
    }
    
    // ========== 删除操作 ==========
    async function 删除方向(实验ID, 方向ID, 方向名称) {
        const 确认 = await 显示确认对话框(
            '🗑️ 删除方向数据',
            `确定要删除该方向的数据吗？\n\n删除后将无法恢复：\n- 该方向的所有应力数据\n- 该方向的所有波形文件\n- 该方向的拟合结果`
        );
        
        if (!确认) return;
        
        try {
            const result = await pywebview.api.删除方向数据(实验ID, 方向ID);
            
            if (result.success) {
                // 🆕 检查前台是否有对应的方向标签，如果有则移除
                // 使用实验ID匹配（因为前台新建的方向可能没有方向ID）
                const 前台索引 = 实验状态.测试方向列表.findIndex(
                    方向 => 方向.实验ID === 实验ID
                );
                
                if (前台索引 >= 0) {
                    const 前台方向名称 = 实验状态.测试方向列表[前台索引].方向名称;
                    实验状态.测试方向列表.splice(前台索引, 1);
                    
                    // 调整当前索引
                    if (实验状态.测试方向列表.length === 0) {
                        实验状态.当前方向索引 = 0;
                    } else if (实验状态.当前方向索引 >= 实验状态.测试方向列表.length) {
                        实验状态.当前方向索引 = 实验状态.测试方向列表.length - 1;
                    }
                    
                    // 更新前台界面
                    更新方向选择器();
                    加载当前方向配置();
                    刷新数据表格();
                    绘制拟合曲线图();
                    
                    显示状态栏信息('✅', `方向"${前台方向名称}"的数据和标签已删除`, '', 'success', 3000);
                } else {
                    显示状态栏信息('✅', '方向数据已删除', '', 'success', 3000);
                }
                
                // 刷新实验列表
                打开实验管理对话框();
            } else {
                显示状态栏信息('❌', `删除失败：${result.message}`, '', 'warning', 3000);
            }
        } catch (error) {
            显示状态栏信息('❌', `删除失败：${error.toString()}`, '', 'warning', 3000);
        }
    }
    
    async function 删除全部数据() {
        const 确认 = await 显示确认对话框(
            '⚠️ 删除所有数据',
            `⚠️ 警告：确定要删除所有实验数据吗？\n\n此操作将：\n- 删除所有实验记录\n- 删除所有波形文件\n- 重置实验ID计数器\n\n删除后将无法恢复！`
        );
        
        if (!确认) return;
        
        // 二次确认
        const 二次确认 = await 显示确认对话框(
            '⚠️ 最后确认',
            `请再次确认：真的要删除所有数据吗？`
        );
        if (!二次确认) return;
        
        try {
            const result = await pywebview.api.删除全部数据();
            
            if (result.success) {
                // 🆕 清空前台所有方向标签
                实验状态.测试方向列表 = [];
                实验状态.当前方向索引 = 0;
                实验状态.材料名称 = "";
                
                // 重置材料名称输入框
                elements.materialName.value = "";
                elements.materialName.disabled = false;
                
                // 更新前台界面
                更新方向选择器();
                加载当前方向配置();
                刷新数据表格();
                绘制拟合曲线图();
                
                显示状态栏信息('✅', '全部数据和标签已清空', '', 'success', 3000);
                // 刷新实验列表
                打开实验管理对话框();
            } else {
                显示状态栏信息('❌', `删除失败：${result.message}`, '', 'warning', 3000);
            }
        } catch (error) {
            显示状态栏信息('❌', `删除失败：${error.toString()}`, '', 'warning', 3000);
        }
    }
    
    // ========== 导出操作 ==========
    async function 导出方向数据(实验ID, 方向ID) {
        try {
            显示状态栏信息('📂', '请选择CSV文件保存位置...', '', 'info', 10000);
            
            const result = await pywebview.api.导出方向CSV数据(实验ID, 方向ID);
            
            if (result.success) {
                const 文件名 = result.文件路径.split(/[/\\]/).pop();
                显示状态栏信息('✅', `CSV导出成功：${文件名}`, '', 'success', 5000);
            } else {
                显示状态栏信息('❌', `导出失败：${result.message}`, '', 'warning', 5000);
            }
        } catch (error) {
            显示状态栏信息('❌', `导出失败：${error.toString()}`, '', 'warning', 5000);
        }
    }
    
    async function 导出全部数据() {
        try {
            显示状态栏信息('📂', '请选择CSV文件保存位置...', '', 'info', 10000);
            
            const result = await pywebview.api.导出全部CSV数据();
            
            if (result.success) {
                const 文件名 = result.文件路径.split(/[/\\]/).pop();
                显示状态栏信息('✅', `CSV导出成功：${文件名}`, '', 'success', 5000);
            } else {
                显示状态栏信息('❌', `导出失败：${result.message}`, '', 'warning', 5000);
            }
        } catch (error) {
            显示状态栏信息('❌', `导出失败：${error.toString()}`, '', 'warning', 5000);
        }
    }
    
    // ========== 数据表格 ==========
    function 刷新数据表格() {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        if (!当前方向 || 当前方向.应力数据.length === 0) {
            elements.dataTableBody.innerHTML = '<tr><td colspan="3" class="empty-message">暂无数据</td></tr>';
            return;
        }
        
        elements.dataTableBody.innerHTML = '';
        
        // 添加基准点（0 MPa）
        const baselineRow = document.createElement('tr');
        baselineRow.innerHTML = `
            <td>0</td>
            <td>0.000</td>
            <td><span style="color: #999;">基准</span></td>
        `;
        elements.dataTableBody.appendChild(baselineRow);
        
        // 🆕 确保数据按应力值排序
        const 排序后数据 = [...当前方向.应力数据].sort((a, b) => a.应力值 - b.应力值);
        
        // 添加应力数据点
        排序后数据.forEach((data, index) => {
            const row = document.createElement('tr');
            const 时间差ns = (data.时间差 * 1e9).toFixed(2);
            
            // 🆕 采集结束后或重测模式下禁用删除按钮
            const 禁用删除 = 当前方向.采集已结束 || 当前方向.重测状态?.启用 ? 'disabled' : '';
            const 删除按钮样式 = (当前方向.采集已结束 || 当前方向.重测状态?.启用) ? 'btn-delete-row disabled' : 'btn-delete-row';
            
            // 🆕 找到原始索引用于删除
            const 原始索引 = 当前方向.应力数据.findIndex(d => d.应力值 === data.应力值);
            
            row.innerHTML = `
                <td>${data.应力值}</td>
                <td>${时间差ns}</td>
                <td>
                    <button class="${删除按钮样式}" onclick="StressCalibrationModule.删除数据点(${原始索引})" ${禁用删除}>删除</button>
                </td>
            `;
            elements.dataTableBody.appendChild(row);
        });
        
        // 使用公共函数自动滚动到最后一行
        const 最后一行 = elements.dataTableBody.lastElementChild;
        if (最后一行 && 排序后数据.length > 0) {
            CommonUtils.scrollToTableRow(最后一行);
        }
    }
    
    async function 删除数据点(index) {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 🆕 采集结束后不允许删除数据点
        if (当前方向.采集已结束) {
            显示状态栏信息('⚠️', '采集已结束，不允许删除数据点', '', 'warning', 3000);
            return;
        }
        
        // 🆕 重测模式下不允许删除其他点
        if (当前方向.重测状态?.启用) {
            显示状态栏信息('⚠️', '请先完成当前重测', '', 'warning', 3000);
            return;
        }
        
        const 数据 = 当前方向.应力数据[index];
        
        // 🆕 显示三选项弹窗
        const 选择结果 = await 显示删除选项对话框(数据.应力值);
        
        if (选择结果 === 'cancel') return;
        
        // 🔧 修复：调用后端API删除数据库中的数据
        try {
            const result = await pywebview.api.删除应力数据点(
                当前方向.实验ID,
                当前方向.方向名称,
                数据.应力值
            );
            
            if (!result.success) {
                显示状态栏信息('❌', `删除失败：${result.message}`, '', 'warning', 3000);
                return;
            }
        } catch (error) {
            显示状态栏信息('❌', `删除失败：${error}`, '', 'warning', 3000);
            return;
        }
        
        // 删除前端数据点
        当前方向.应力数据.splice(index, 1);
        
        // 如果数据点不足，清除拟合结果
        if (当前方向.应力数据.length < 2) {
            当前方向.拟合结果 = null;
        }
        
        if (选择结果 === 'recapture') {
            // 🆕 重新采集模式
            const 当前应力值 = parseFloat(elements.currentStress.value);
            
            // 设置重测状态
            当前方向.重测状态 = {
                启用: true,
                重测应力值: 数据.应力值,
                返回应力值: 当前应力值
            };
            
            // 更新应力框为重测值
            elements.currentStress.value = 数据.应力值;
            
            // 显示重测标记
            const recaptureTag = document.getElementById('sd-recaptureTag');
            if (recaptureTag) {
                recaptureTag.style.display = 'inline';
            }
            
            显示状态栏信息('🔄', `进入重测模式：${数据.应力值} MPa`, '采集完成后将自动返回', 'info', 3000);
        } else {
            // 跳过模式，直接删除
            显示状态栏信息('✅', `已跳过数据点：${数据.应力值} MPa`, '', 'success', 3000);
        }
        
        // 刷新界面（采集结束前不刷新拟合曲线）
        刷新数据表格();
        更新按钮状态();
        更新方向选择器();
    }
    
    // 🆕 显示删除选项对话框（三选项）
    function 显示删除选项对话框(应力值) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.style.display = 'flex';
            
            overlay.innerHTML = `
                <div class="modal-content field-modal modal-sm">
                    <div class="modal-header">
                        <h3>🗑️ 删除数据点</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="confirm-message">确定要删除数据点 <strong>${应力值} MPa</strong> 吗？</p>
                        <p style="color: #666; font-size: 13px; margin-top: 10px;">请选择后续操作：</p>
                    </div>
                    <div class="modal-footer" style="flex-direction: column; gap: 8px;">
                        <button class="btn btn-primary recapture-btn" style="width: 100%;">🔄 重新采集该点</button>
                        <button class="btn btn-warning skip-btn" style="width: 100%;">⏭️ 跳过此点</button>
                        <button class="btn btn-secondary cancel-btn" style="width: 100%;">取消</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            const cleanup = () => document.body.removeChild(overlay);
            
            overlay.querySelector('.modal-close').onclick = () => { cleanup(); resolve('cancel'); };
            overlay.querySelector('.cancel-btn').onclick = () => { cleanup(); resolve('cancel'); };
            overlay.querySelector('.recapture-btn').onclick = () => { cleanup(); resolve('recapture'); };
            overlay.querySelector('.skip-btn').onclick = () => { cleanup(); resolve('skip'); };
            
            // ESC键取消
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve('cancel');
                    document.removeEventListener('keydown', handleKeydown);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }
    
    // ========== 拟合曲线 ==========
    async function 绘制拟合曲线() {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        try {
            elements.fitMessage.textContent = '正在计算拟合...';
            elements.fitMessage.style.display = 'block';
            
            const result = await pywebview.api.线性拟合应力时间差(
                当前方向.实验ID,
                当前方向.方向名称
            );
            
            if (result.success) {
                当前方向.拟合结果 = result.data;
                
                // 显示拟合公式
                const 斜率 = (result.data.斜率 * 1e9).toFixed(3);
                const 截距 = (result.data.截距 * 1e9).toFixed(3);
                const R方 = result.data.R方.toFixed(4);
                
                elements.fitEquation.textContent = `Δt = ${斜率}σ + ${截距} (R²=${R方})`;
                
                // 先调整画布尺寸，再绘制曲线
                调整拟合画布();
                更新按钮状态();
                更新方向选择器();
                
                elements.fitMessage.style.display = 'none';
                
                显示状态栏信息('✅', `拟合完成：斜率 ${斜率} ns/MPa，R² = ${R方}`, '', 'success', 3000);
            } else {
                elements.fitMessage.style.display = 'none';
                显示状态栏信息('❌', `拟合失败：${result.message}`, '', 'warning', 3000);
            }
        } catch (error) {
            elements.fitMessage.style.display = 'none';
            显示状态栏信息('❌', `拟合失败：${error}`, '', 'warning', 3000);
        }
    }
    
    function 绘制拟合曲线图() {
        const rect = fitCanvas.parentElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // 清空画布
        fitCtx.fillStyle = 'white';
        fitCtx.fillRect(0, 0, width, height);
        
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        if (!当前方向 || 当前方向.应力数据.length === 0) {
            elements.fitMessage.style.display = 'block';
            return;
        }
        
        elements.fitMessage.style.display = 'none';
        
        const padding = { top: 40, right: 50, bottom: 60, left: 70 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // 准备数据
        const 应力数组 = [0, ...当前方向.应力数据.map(d => d.应力值)];
        const 时间差数组 = [0, ...当前方向.应力数据.map(d => d.时间差 * 1e9)];
        
        // 计算范围
        const 应力最大 = Math.max(...应力数组);
        const 时间差最大 = Math.max(...时间差数组.map(Math.abs));
        const 时间差最小 = Math.min(...时间差数组);
        
        // 绘制网格
        fitCtx.strokeStyle = '#e0e0e0';
        fitCtx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const x = padding.left + (chartWidth / 5) * i;
            fitCtx.beginPath();
            fitCtx.moveTo(x, padding.top);
            fitCtx.lineTo(x, padding.top + chartHeight);
            fitCtx.stroke();
            
            const y = padding.top + (chartHeight / 5) * i;
            fitCtx.beginPath();
            fitCtx.moveTo(padding.left, y);
            fitCtx.lineTo(padding.left + chartWidth, y);
            fitCtx.stroke();
        }
        
        // 绘制坐标轴
        fitCtx.strokeStyle = '#333';
        fitCtx.lineWidth = 2;
        fitCtx.beginPath();
        fitCtx.moveTo(padding.left, padding.top);
        fitCtx.lineTo(padding.left, padding.top + chartHeight);
        fitCtx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        fitCtx.stroke();
        
        // 绘制拟合直线
        if (当前方向.拟合结果) {
            const 斜率 = 当前方向.拟合结果.斜率 * 1e9;
            const 截距 = 当前方向.拟合结果.截距 * 1e9;
            
            fitCtx.strokeStyle = '#d32f2f';
            fitCtx.lineWidth = 2;
            fitCtx.beginPath();
            
            const x1 = padding.left;
            const y1_value = 截距;
            const y1 = padding.top + chartHeight - ((y1_value - 时间差最小) / (时间差最大 - 时间差最小)) * chartHeight;
            
            const x2 = padding.left + chartWidth;
            const y2_value = 斜率 * 应力最大 + 截距;
            const y2 = padding.top + chartHeight - ((y2_value - 时间差最小) / (时间差最大 - 时间差最小)) * chartHeight;
            
            fitCtx.moveTo(x1, y1);
            fitCtx.lineTo(x2, y2);
            fitCtx.stroke();
        }
        
        // 绘制数据点
        fitCtx.fillStyle = '#333';
        for (let i = 0; i < 应力数组.length; i++) {
            const x = padding.left + (应力数组[i] / 应力最大) * chartWidth;
            const y = padding.top + chartHeight - ((时间差数组[i] - 时间差最小) / (时间差最大 - 时间差最小)) * chartHeight;
            
            fitCtx.beginPath();
            fitCtx.arc(x, y, 5, 0, 2 * Math.PI);
            fitCtx.fill();
        }
        
        // 绘制坐标轴标签
        fitCtx.fillStyle = '#333';
        fitCtx.font = '14px Arial';
        fitCtx.textAlign = 'center';
        fitCtx.textBaseline = 'top';
        fitCtx.fillText('应力 (MPa)', padding.left + chartWidth / 2, padding.top + chartHeight + 35);
        
        fitCtx.save();
        fitCtx.translate(25, padding.top + chartHeight / 2);
        fitCtx.rotate(-Math.PI / 2);
        fitCtx.fillText('声时差 (ns)', 0, 0);
        fitCtx.restore();
        
        // 绘制刻度值
        fitCtx.font = '12px Arial';
        fitCtx.textAlign = 'center';
        fitCtx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const x = padding.left + (chartWidth / 5) * i;
            const value = (应力最大 / 5 * i).toFixed(0);
            fitCtx.fillText(value, x, padding.top + chartHeight + 10);
        }
        
        fitCtx.textAlign = 'right';
        fitCtx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + chartHeight - (chartHeight / 5) * i;
            const value = (时间差最小 + (时间差最大 - 时间差最小) / 5 * i).toFixed(1);
            fitCtx.fillText(value, padding.left - 10, y);
        }
    }
    
    function 调整拟合画布() {
        if (!fitCanvas || !fitCanvas.parentElement) return;
        
        const container = fitCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        fitCanvas.width = rect.width * window.devicePixelRatio;
        fitCanvas.height = rect.height * window.devicePixelRatio;
        
        fitCanvas.style.width = rect.width + 'px';
        fitCanvas.style.height = rect.height + 'px';
        
        fitCtx.setTransform(1, 0, 0, 1, 0, 0);
        fitCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // 重绘
        绘制拟合曲线图();
    }
    
    // ========== 数据导出（当前方向CSV）==========
    async function 导出当前方向CSV() {
        try {
            显示状态栏信息('📂', '请选择CSV文件保存位置...', '', 'info', 10000);
            
            const pathResult = await pywebview.api.选择CSV保存路径();
            
            if (!pathResult.success) {
                显示状态栏信息('ℹ️', '已取消导出', '', 'info', 2000);
                return;
            }
            
            显示状态栏信息('⏳', '正在保存CSV文件...', '', 'info', 10000);
            
            const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
            
            const 实验数据 = {
                metadata: {
                    material: 实验状态.材料名称,
                    direction: 当前方向.方向名称
                },
                measurements: 当前方向.应力数据,
                analysis: 当前方向.拟合结果
            };
            
            const result = await pywebview.api.保存CSV格式(pathResult.path, 实验数据);
            
            if (result.success) {
                const 文件名 = pathResult.path.split(/[/\\]/).pop();
                显示状态栏信息('✅', `CSV导出成功：${文件名}`, '', 'success', 5000);
            } else {
                显示状态栏信息('❌', `CSV导出失败：${result.message}`, '', 'warning', 5000);
            }
        } catch (error) {
            显示状态栏信息('❌', `导出失败：${error.toString()}`, '', 'warning', 5000);
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        刷新数据表格,
        删除数据点,
        绘制拟合曲线,
        绘制拟合曲线图,
        调整拟合画布,
        导出当前方向CSV,
        打开实验管理对话框,
        关闭实验管理对话框,
        加载实验方向,
        删除方向,
        删除全部数据,
        导出方向数据,
        导出全部数据
    };
})();
