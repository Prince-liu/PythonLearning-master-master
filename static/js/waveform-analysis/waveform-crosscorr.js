// ==================== 波形互相关子模块 ====================
// 负责互相关分析功能

const WaveformCrossCorr = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 已加载文件列表 = [];
    let 互相关结果 = [];
    let 参考信号名称 = '';
    
    // ========== 回调函数 ==========
    let 重绘回调 = null;
    let 状态回调 = null;
    let 显示状态栏信息回调 = null;
    
    // ========== 初始化函数 ==========
    function 初始化(配置) {
        重绘回调 = 配置.重绘回调;
        状态回调 = 配置.状态回调;
        显示状态栏信息回调 = 配置.显示状态栏信息回调;
        
        // 绑定事件
        const selectMultipleFilesBtn = document.getElementById('selectMultipleFilesBtn');
        const calculateCrossCorr = document.getElementById('calculateCrossCorr');
        const exportCrossCorr = document.getElementById('exportCrossCorr');
        const openSignalProcessingConfig = document.getElementById('openSignalProcessingConfig');
        const waDenoiseCheckbox = document.getElementById('wa-denoise-checkbox');
        const waBandpassCheckbox = document.getElementById('wa-bandpass-checkbox');
        
        if (selectMultipleFilesBtn) {
            selectMultipleFilesBtn.addEventListener('click', 选择多个文件);
        }
        if (calculateCrossCorr) {
            calculateCrossCorr.addEventListener('click', 计算互相关);
        }
        if (exportCrossCorr) {
            exportCrossCorr.addEventListener('click', 导出结果);
        }
        if (openSignalProcessingConfig) {
            openSignalProcessingConfig.addEventListener('click', 打开配置弹窗);
        }
        
        // 绑定复选框事件 - 直接切换配置
        if (waDenoiseCheckbox) {
            waDenoiseCheckbox.addEventListener('change', async (e) => {
                try {
                    const enabled = e.target.checked;
                    // 获取当前配置
                    const result = await pywebview.api.获取波形分析降噪配置();
                    if (result.success && result.data) {
                        const config = result.data;
                        config.enabled = enabled;
                        // 保存配置
                        await pywebview.api.设置波形分析降噪配置(config);
                        if (显示状态栏信息回调) {
                            显示状态栏信息回调('✓', '配置已更新', `降噪已${enabled ? '启用' : '禁用'}，重新计算互相关后生效`, 'success', 2000);
                        }
                    }
                } catch (error) {
                    console.error('切换降噪配置失败:', error);
                    e.target.checked = !e.target.checked; // 恢复原状态
                }
            });
        }
        
        if (waBandpassCheckbox) {
            waBandpassCheckbox.addEventListener('change', async (e) => {
                try {
                    const enabled = e.target.checked;
                    // 获取当前配置
                    const result = await pywebview.api.获取波形分析带通滤波配置();
                    if (result.success && result.data) {
                        const config = result.data;
                        config.enabled = enabled;
                        // 保存配置
                        await pywebview.api.设置波形分析带通滤波配置(config);
                        if (显示状态栏信息回调) {
                            显示状态栏信息回调('✓', '配置已更新', `带通滤波已${enabled ? '启用' : '禁用'}，重新计算互相关后生效`, 'success', 2000);
                        }
                    }
                } catch (error) {
                    console.error('切换带通滤波配置失败:', error);
                    e.target.checked = !e.target.checked; // 恢复原状态
                }
            });
        }
        
        // 初始化配置状态显示
        更新配置状态显示();
    }
    
    // ========== 配置管理 ==========
    async function 打开配置弹窗() {
        try {
            // 从后端加载当前配置
            const denoiseResult = await pywebview.api.获取波形分析降噪配置();
            const bandpassResult = await pywebview.api.获取波形分析带通滤波配置();
            
            if (denoiseResult.success && denoiseResult.data) {
                const config = denoiseResult.data;
                document.getElementById('wa-denoise-wavelet').value = config.wavelet || 'sym6';
                document.getElementById('wa-denoise-level').value = config.level || 5;
                document.getElementById('wa-denoise-threshold-mode').value = config.threshold_mode || 'soft';
            }
            
            if (bandpassResult.success && bandpassResult.data) {
                const config = bandpassResult.data;
                document.getElementById('wa-bandpass-lowcut').value = config.lowcut || 1.5;
                document.getElementById('wa-bandpass-highcut').value = config.highcut || 3.5;
                document.getElementById('wa-bandpass-order').value = config.order || 6;
            }
            
            // 显示弹窗
            document.getElementById('waveformAnalysisConfigModal').style.display = 'flex';
        } catch (error) {
            console.error('打开配置弹窗失败:', error);
            alert('打开配置弹窗失败');
        }
    }
    
    async function 更新配置状态显示() {
        try {
            const denoiseResult = await pywebview.api.获取波形分析降噪配置();
            const bandpassResult = await pywebview.api.获取波形分析带通滤波配置();
            
            const denoiseCheckbox = document.getElementById('wa-denoise-checkbox');
            const bandpassCheckbox = document.getElementById('wa-bandpass-checkbox');
            
            if (denoiseResult.success && denoiseResult.data) {
                const enabled = denoiseResult.data.enabled !== false;
                if (denoiseCheckbox) {
                    denoiseCheckbox.checked = enabled;
                }
            }
            
            if (bandpassResult.success && bandpassResult.data) {
                const enabled = bandpassResult.data.enabled === true;
                if (bandpassCheckbox) {
                    bandpassCheckbox.checked = enabled;
                }
            }
        } catch (error) {
            console.error('更新配置状态显示失败:', error);
        }
    }
    
    // 全局函数：关闭配置弹窗
    window.closeWaveformAnalysisConfigModal = function() {
        document.getElementById('waveformAnalysisConfigModal').style.display = 'none';
    };
    
    // 全局函数：保存配置
    window.saveWaveformAnalysisConfig = async function() {
        try {
            // 读取降噪配置（保持当前的enabled状态）
            const denoiseResult = await pywebview.api.获取波形分析降噪配置();
            const denoiseConfig = denoiseResult.success && denoiseResult.data ? denoiseResult.data : {};
            
            denoiseConfig.method = 'wavelet';
            denoiseConfig.wavelet = document.getElementById('wa-denoise-wavelet').value;
            denoiseConfig.level = parseInt(document.getElementById('wa-denoise-level').value);
            denoiseConfig.threshold_mode = document.getElementById('wa-denoise-threshold-mode').value;
            denoiseConfig.threshold_rule = 'heursure';
            
            // 读取带通滤波配置（保持当前的enabled状态）
            const bandpassResult = await pywebview.api.获取波形分析带通滤波配置();
            const bandpassConfig = bandpassResult.success && bandpassResult.data ? bandpassResult.data : {};
            
            bandpassConfig.lowcut = parseFloat(document.getElementById('wa-bandpass-lowcut').value);
            bandpassConfig.highcut = parseFloat(document.getElementById('wa-bandpass-highcut').value);
            bandpassConfig.order = parseInt(document.getElementById('wa-bandpass-order').value);
            
            // 验证参数
            if (bandpassConfig.lowcut >= bandpassConfig.highcut) {
                alert('低频截止必须小于高频截止');
                return;
            }
            
            if (bandpassConfig.lowcut < 1 || bandpassConfig.lowcut > 6 || bandpassConfig.highcut < 1 || bandpassConfig.highcut > 6) {
                alert('频率范围必须在 1-6 MHz 之间');
                return;
            }
            
            // 保存到后端
            await pywebview.api.设置波形分析降噪配置(denoiseConfig);
            await pywebview.api.设置波形分析带通滤波配置(bandpassConfig);
            
            // 更新状态显示
            await 更新配置状态显示();
            
            // 关闭弹窗
            window.closeWaveformAnalysisConfigModal();
            
            // 提示用户
            if (显示状态栏信息回调) {
                显示状态栏信息回调('✓', '配置已保存', '重新计算互相关后生效', 'success', 2000);
            }
        } catch (error) {
            console.error('保存配置失败:', error);
            alert('保存配置失败');
        }
    };
    
    // ========== 选择多个文件 ==========
    async function 选择多个文件() {
        try {
            状态回调('正在选择文件...');
            
            const result = await pywebview.api.选择多个CSV文件();
            
            if (result.success && result.paths && result.paths.length > 0) {
                状态回调('正在加载文件...');
                
                // 加载文件
                const loadResult = await pywebview.api.加载多个CSV文件(result.paths);
                
                if (loadResult.success) {
                    已加载文件列表 = loadResult.files;
                    
                    // 显示文件列表
                    显示文件列表(已加载文件列表);
                    
                    // 填充参考信号下拉框
                    填充参考信号选择框(已加载文件列表);
                    
                    // 显示配置面板
                    const signalProcessingConfigGroup = document.getElementById('signalProcessingConfigGroup');
                    if (signalProcessingConfigGroup) {
                        signalProcessingConfigGroup.style.display = 'block';
                    }
                    
                    // 启用计算按钮
                    document.getElementById('calculateCrossCorr').disabled = false;
                    
                    状态回调(`已加载 ${loadResult.count} 个文件`);
                    
                    // 显示状态
                    const statusBox = document.getElementById('crossCorrStatus');
                    const statusText = document.getElementById('crossCorrStatusText');
                    if (statusBox && statusText) {
                        statusText.textContent = `已加载 ${loadResult.count} 个文件，已应用信号处理配置`;
                        statusBox.style.display = 'block';
                    }
                } else {
                    if (显示状态栏信息回调) {
                        显示状态栏信息回调('❌', '加载文件失败', loadResult.message, 'error', 4000);
                    }
                    状态回调('');
                }
            } else {
                状态回调('');
            }
        } catch (error) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('❌', '选择文件失败', error.toString(), 'error', 4000);
            }
            状态回调('');
        }
    }
    
    // ========== 显示文件列表 ==========
    function 显示文件列表(文件列表) {
        const fileListDisplay = document.getElementById('fileListDisplay');
        const fileList = document.getElementById('fileList');
        
        if (!fileListDisplay || !fileList) return;
        
        fileList.innerHTML = '';
        文件列表.forEach((文件名, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.textContent = `${index + 1}. ${文件名}`;
            fileList.appendChild(item);
        });
        
        fileListDisplay.style.display = 'block';
    }
    
    // ========== 填充参考信号选择框 ==========
    function 填充参考信号选择框(文件列表) {
        const select = document.getElementById('referenceSignalSelect');
        const group = document.getElementById('referenceSelectGroup');
        const truncateGroup = document.getElementById('truncateRangeGroup');
        
        if (!select || !group) return;
        
        select.innerHTML = '<option value="">请选择参考信号</option>';
        文件列表.forEach((文件名, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = 文件名;
            select.appendChild(option);
        });
        
        group.style.display = 'block';
        if (truncateGroup) truncateGroup.style.display = 'block';
    }
    
    // ========== 计算互相关 ==========
    async function 计算互相关() {
        try {
            const select = document.getElementById('referenceSignalSelect');
            const 参考索引 = parseInt(select.value);
            
            if (isNaN(参考索引)) {
                if (显示状态栏信息回调) {
                    显示状态栏信息回调('⚠️', '无法计算', '请先选择参考基准信号', 'warning', 3000);
                }
                return;
            }
            
            // 获取截取范围
            const truncateStartInput = document.getElementById('truncateStartInput');
            const truncateEndInput = document.getElementById('truncateEndInput');
            
            // 🔧 支持左侧不截取：
            // - 空值 = 不截取（从信号开头开始，传null给后端）
            // - 0 = 从0μs开始截取（这是一个具体的时间点）
            // - 其他数值 = 从该时间点开始截取
            const truncateStartValue = truncateStartInput.value.trim();
            let truncateStart;
            if (truncateStartValue === '') {
                truncateStart = null;  // 空值表示不截取
            } else {
                truncateStart = parseFloat(truncateStartValue);
                if (isNaN(truncateStart)) {
                    if (显示状态栏信息回调) {
                        显示状态栏信息回调('⚠️', '参数错误', '起始时间必须是有效数字', 'warning', 3000);
                    }
                    return;
                }
            }
            
            const truncateEndValue = truncateEndInput.value.trim();
            const truncateEnd = truncateEndValue ? parseFloat(truncateEndValue) : null;
            
            // 验证范围
            if (truncateStart !== null && truncateEnd !== null && truncateEnd <= truncateStart) {
                if (显示状态栏信息回调) {
                    显示状态栏信息回调('⚠️', '参数错误', '结束时间必须大于起始时间', 'warning', 3000);
                }
                return;
            }
            
            状态回调('正在计算互相关...');
            
            const result = await pywebview.api.计算互相关(参考索引, truncateStart, truncateEnd);
            
            if (result.success) {
                互相关结果 = result.results;
                参考信号名称 = result.reference_name;
                
                // 显示结果
                显示互相关结果(互相关结果);
                
                // 绘制互相关波形
                绘制互相关波形(互相关结果);
                
                // 启用导出按钮
                document.getElementById('exportCrossCorr').disabled = false;
                
                状态回调('');
                
                // 更新状态
                const statusText = document.getElementById('crossCorrStatusText');
                if (statusText) {
                    const methodNames = {
                        'standard': '频域互相关',
                        'normalized': '广域互相关',
                        'gcc_phat': 'GCC-PHAT'
                    };
                    const methodText = methodNames[result.method] || result.method;
                    statusText.textContent = `计算完成（${methodText}），共 ${互相关结果.length} 对互相关结果`;
                }
            } else {
                if (显示状态栏信息回调) {
                    显示状态栏信息回调('❌', '计算失败', result.message, 'error', 4000);
                }
                状态回调('');
            }
        } catch (error) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('❌', '计算失败', error.toString(), 'error', 4000);
            }
            状态回调('');
        }
    }
    
    // ========== 显示互相关结果 ==========
    function 显示互相关结果(结果列表) {
        const resultsDisplay = document.getElementById('crossCorrResultsDisplay');
        const resultsList = document.getElementById('crossCorrResultsList');
        
        if (!resultsDisplay || !resultsList) return;
        
        // 显示结果区域
        resultsDisplay.style.display = 'block';
        
        // 清空并填充结果
        resultsList.innerHTML = '';
        
        结果列表.forEach((结果, index) => {
            const item = document.createElement('div');
            item.className = 'cross-corr-result-item';
            item.style.cssText = 'padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #2563eb;';
            
            // 将微秒转换为纳秒
            const time_delay_us = 结果.time_delay_us;
            const time_delay_ns = time_delay_us * 1000;
            
            // 根据时间延迟大小选择合适的单位显示
            let displayText;
            if (Math.abs(time_delay_ns) <= 999) {
                displayText = `${time_delay_ns.toFixed(2)} ns`;
            } else if (Math.abs(time_delay_us) < 1000) {
                displayText = `${time_delay_us.toFixed(3)} μs`;
            } else {
                displayText = `${(time_delay_us / 1000).toFixed(3)} ms`;
            }
            
            item.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 6px; color: #1e40af;">结果 ${index + 1}</div>
                <div style="font-size: 13px; color: #4b5563; margin-bottom: 3px;">
                    <span style="color: #6b7280;">参考:</span> ${结果.reference_name}
                </div>
                <div style="font-size: 13px; color: #4b5563; margin-bottom: 3px;">
                    <span style="color: #6b7280;">对比:</span> ${结果.compare_name}
                </div>
                <div style="font-size: 14px; font-weight: 600; color: #059669; margin-top: 6px;">
                    时间延迟: ${displayText}
                </div>
            `;
            
            resultsList.appendChild(item);
        });
    }
    
    // ========== 绘制互相关波形 ==========
    function 绘制互相关波形(结果列表) {
        if (!重绘回调) {
            return;
        }
        
        try {
            // 准备绘制数据
            const 绘制数据 = {
                type: 'crosscorr',
                results: 结果列表
            };
            
            重绘回调(绘制数据);
        } catch (error) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('❌', '绘制波形失败', error.message, 'error', 4000);
            }
        }
    }
    

    
    // ========== 导出结果 ==========
    async function 导出结果() {
        try {
            if (互相关结果.length === 0) {
                if (显示状态栏信息回调) {
                    显示状态栏信息回调('⚠️', '无法导出', '没有可导出的结果', 'warning', 3000);
                }
                return;
            }
            
            const pathResult = await pywebview.api.选择互相关CSV保存路径();
            
            if (pathResult.success) {
                const exportResult = await pywebview.api.导出互相关结果(pathResult.path);
                
                if (exportResult.success) {
                    if (显示状态栏信息回调) {
                        显示状态栏信息回调('✓', '导出成功', '互相关结果已保存', 'success', 3000);
                    }
                } else {
                    if (显示状态栏信息回调) {
                        显示状态栏信息回调('❌', '导出失败', exportResult.message, 'error', 4000);
                    }
                }
            }
        } catch (error) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('❌', '导出失败', error.toString(), 'error', 4000);
            }
        }
    }
    
    // ========== 清除状态 ==========
    function 清除状态() {
        已加载文件列表 = [];
        互相关结果 = [];
        参考信号名称 = '';
        
        // 隐藏UI元素
        const fileListDisplay = document.getElementById('fileListDisplay');
        const referenceSelectGroup = document.getElementById('referenceSelectGroup');
        const truncateRangeGroup = document.getElementById('truncateRangeGroup');
        const crossCorrStatus = document.getElementById('crossCorrStatus');
        const resultsDisplay = document.getElementById('crossCorrResultsDisplay');
        
        if (fileListDisplay) fileListDisplay.style.display = 'none';
        if (referenceSelectGroup) referenceSelectGroup.style.display = 'none';
        if (truncateRangeGroup) truncateRangeGroup.style.display = 'none';
        if (crossCorrStatus) crossCorrStatus.style.display = 'none';
        if (resultsDisplay) resultsDisplay.style.display = 'none';
        
        // 重置截取范围输入框（空值表示不截取）
        const truncateStartInput = document.getElementById('truncateStartInput');
        const truncateEndInput = document.getElementById('truncateEndInput');
        if (truncateStartInput) truncateStartInput.value = '';
        if (truncateEndInput) truncateEndInput.value = '';
        
        // 禁用按钮
        document.getElementById('calculateCrossCorr').disabled = true;
        document.getElementById('exportCrossCorr').disabled = true;
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        清除状态,
        获取互相关结果: () => 互相关结果
    };
})();
