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
        
        if (selectMultipleFilesBtn) {
            selectMultipleFilesBtn.addEventListener('click', 选择多个文件);
        }
        if (calculateCrossCorr) {
            calculateCrossCorr.addEventListener('click', 计算互相关);
        }
        if (exportCrossCorr) {
            exportCrossCorr.addEventListener('click', 导出结果);
        }
    }
    
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
                    
                    // 启用计算按钮
                    document.getElementById('calculateCrossCorr').disabled = false;
                    
                    状态回调(`已加载 ${loadResult.count} 个文件`);
                    
                    // 显示状态
                    const statusBox = document.getElementById('crossCorrStatus');
                    const statusText = document.getElementById('crossCorrStatusText');
                    if (statusBox && statusText) {
                        statusText.textContent = `已加载 ${loadResult.count} 个文件，已自动降噪和截断`;
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
            
            const truncateStart = parseFloat(truncateStartInput.value) || 5.0;
            const truncateEndValue = truncateEndInput.value.trim();
            const truncateEnd = truncateEndValue ? parseFloat(truncateEndValue) : null;
            
            // 验证范围
            if (truncateEnd !== null && truncateEnd <= truncateStart) {
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
                    statusText.textContent = `计算完成，共 ${互相关结果.length} 对互相关结果`;
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
        
        // 重置截取范围输入框
        const truncateStartInput = document.getElementById('truncateStartInput');
        const truncateEndInput = document.getElementById('truncateEndInput');
        if (truncateStartInput) truncateStartInput.value = '5.0';
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
