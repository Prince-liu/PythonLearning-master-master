// ==================== 实时采集模块 ====================
// 负责设备连接、波形采集、显示控制、参数设置

const RealtimeCapture = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let canvas, ctx;
    let 已连接 = false;
    let 正在采集 = false;
    let 波形数据 = {
        时间: [],
        电压: [],
        时间单位: 'μs',
        时间缩放: 1e6
    };
    
    // 🆕 订阅者列表（发布-订阅模式）
    let 波形订阅者列表 = [];
    
    // 标准示波器垂直档位序列（V/div）- 范围：10mV ~ 10V
    const 垂直档位序列 = [
        0.01,    // 10mV
        0.02,    // 20mV
        0.05,    // 50mV
        0.1,     // 100mV
        0.2,     // 200mV
        0.5,     // 500mV
        1,       // 1V
        2,       // 2V
        5,       // 5V
        10       // 10V
    ];
    
    // 波形显示控制状态
    let 波形显示状态 = {
        timeOffset: 0,
        voltageOffset: 0,
        当前垂直档位索引: null,  // 当前档位在序列中的索引
        显示垂直档位: null
    };
    
    // 用户操作保护机制
    let 最后操作时间 = 0;
    const 操作保护时间 = 1000;
    
    // 采集计数
    let 采集计数 = 0;
    
    // 防抖定时器
    let 水平移动定时器 = null;
    let 垂直缩放定时器 = null;
    
    // 当前保存格式
    let 当前保存格式 = 'npy';
    
    // 微调模式状态
    let 微调模式 = false;
    
    // 首次波形显示标志
    let 首次显示波形 = true;
    
    // ========== DOM 元素 ==========
    let elements = {};
    
    // ========== 初始化函数 ==========
    function 初始化(canvasElement, ctxElement) {
        canvas = canvasElement;
        ctx = ctxElement;
        
        // 获取所有 DOM 元素
        elements = {
            searchBtn: document.getElementById('searchBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            deviceSelect: document.getElementById('deviceSelect'),
            channelSelect: document.getElementById('channelSelect'),
            memoryDepthSelect: document.getElementById('memoryDepthSelect'),
            timebaseSelect: document.getElementById('timebaseSelect'),
            captureBtn: document.getElementById('captureBtn'),
            saveBtn: document.getElementById('saveBtn'),
            saveDropdownBtn: document.getElementById('saveDropdownBtn'),
            saveDropdownMenu: document.getElementById('saveDropdownMenu'),
            autoSetBtn: document.getElementById('autoSetBtn'),
            runBtn: document.getElementById('runBtn'),
            stopScopeBtn: document.getElementById('stopScopeBtn'),
            statusMessage: document.getElementById('statusMessage'),
            waveformTitle: document.getElementById('waveformTitle'),
            sampleRateValue: document.getElementById('sampleRateValue'),
            memoryDepthValue: document.getElementById('memoryDepthValue'),
            timebaseValue: document.getElementById('timebaseValue'),
            // 波形控制按钮
            hLeftFastBtn: document.getElementById('hLeftFastBtn'),
            hLeftBtn: document.getElementById('hLeftBtn'),
            hCenterBtn: document.getElementById('hCenterBtn'),
            hRightBtn: document.getElementById('hRightBtn'),
            hRightFastBtn: document.getElementById('hRightFastBtn'),
            vCenterBtn: document.getElementById('vCenterBtn'),
            vScaleUpBtn: document.getElementById('vScaleUpBtn'),
            vScaleDownBtn: document.getElementById('vScaleDownBtn'),
            vScaleValue: document.getElementById('vScaleValue'),
            vFineTuneBtn: document.getElementById('vFineTuneBtn'),
            resetViewBtn: document.getElementById('resetViewBtn'),
            statusChannelValue: document.getElementById('statusChannelValue'),
            // 🆕 状态栏信息面板（统一显示所有信息）
            statusBarInfoPanel: document.getElementById('statusBarInfoPanel'),
            statusBarInfoIcon: document.getElementById('statusBarInfoIcon'),
            statusBarInfoText: document.getElementById('statusBarInfoText'),
            statusBarInfoDetail: document.getElementById('statusBarInfoDetail')
        };
        
        // 绑定事件
        绑定事件();
        
        // 初始化显示
        更新垂直档位显示();
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 搜索设备
        elements.searchBtn.addEventListener('click', 搜索设备);
        
        // 断开连接
        elements.disconnectBtn.addEventListener('click', 断开连接);
        
        // 存储深度选择
        elements.memoryDepthSelect.addEventListener('change', 设置存储深度);
        
        // 时基选择
        elements.timebaseSelect.addEventListener('change', 设置时基);
        
        // 采集波形
        elements.captureBtn.addEventListener('click', 开始采集);
        

        
        // 通道选择
        elements.channelSelect.addEventListener('change', () => {
            const 通道 = elements.channelSelect.value;
            elements.statusChannelValue.textContent = `CHAN${通道}`;
            elements.waveformTitle.textContent = `示波器波形显示 - CHAN${通道}`;
        });
        
        // 自动设置
        elements.autoSetBtn.addEventListener('click', 自动设置);
        
        // 运行/停止示波器
        elements.runBtn.addEventListener('click', 运行示波器);
        elements.stopScopeBtn.addEventListener('click', 停止示波器);
        
        // 保存波形
        elements.saveBtn.addEventListener('click', () => 保存波形(当前保存格式));
        elements.saveDropdownBtn.addEventListener('click', 切换保存菜单);
        
        // 保存格式选择
        document.querySelectorAll('#saveDropdownMenu .dropdown-item').forEach(item => {
            item.addEventListener('click', 选择保存格式);
        });
        
        // 点击其他地方关闭下拉菜单
        document.addEventListener('click', () => {
            elements.saveDropdownMenu.classList.remove('show');
        });
        
        // 水平控制
        elements.hLeftFastBtn.addEventListener('click', () => 水平移动(-2));
        elements.hLeftBtn.addEventListener('click', () => 水平移动(-0.5));
        elements.hCenterBtn.addEventListener('click', 水平回中);
        elements.hRightBtn.addEventListener('click', () => 水平移动(0.5));
        elements.hRightFastBtn.addEventListener('click', () => 水平移动(2));
        
        // 垂直控制
        elements.vCenterBtn.addEventListener('click', 垂直回中);
        elements.vScaleUpBtn.addEventListener('click', () => 垂直缩放(1));  // +按钮：增大档位值（1V→2V）
        elements.vScaleDownBtn.addEventListener('click', () => 垂直缩放(-1));  // -按钮：减小档位值（1V→500mV）
        elements.vFineTuneBtn.addEventListener('click', 切换微调模式);  // 微调按钮
        
        // 恢复默认视图
        elements.resetViewBtn.addEventListener('click', 恢复默认视图);
        
        // 禁用滚轮缩放
        // canvas.addEventListener('wheel', 滚轮缩放);
    }
    
    // ========== 设备管理 ==========
    async function 搜索设备() {
        try {
            elements.statusMessage.textContent = '正在搜索设备...';
            const result = await pywebview.api.搜索设备();
            
            if (result.success && result.devices.length > 0) {
                elements.deviceSelect.innerHTML = '';
                result.devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device;
                    option.textContent = device;
                    elements.deviceSelect.appendChild(option);
                });
                elements.statusMessage.textContent = `找到 ${result.devices.length} 个设备`;
                
                // 自动连接第一个设备
                await 连接设备(result.devices[0]);
            } else {
                elements.deviceSelect.innerHTML = '<option value="">未找到设备</option>';
                elements.statusMessage.textContent = '未找到任何VISA设备';
                显示状态栏信息('⚠️', '未找到设备', '请检查示波器连接', 'warning', 4000);
            }
        } catch (error) {
            elements.statusMessage.textContent = '搜索失败';
            显示状态栏信息('❌', '搜索设备失败', error.toString(), 'error', 4000);
        }
    }
    
    async function 连接设备(设备地址) {
        try {
            const result = await pywebview.api.连接示波器(设备地址);
            
            if (result.success) {
                已连接 = true;
                elements.disconnectBtn.disabled = false;
                elements.captureBtn.disabled = false;
                elements.searchBtn.disabled = true;
                elements.memoryDepthSelect.disabled = false;
                elements.timebaseSelect.disabled = false;
                elements.autoSetBtn.disabled = false;
                elements.runBtn.disabled = false;
                elements.stopScopeBtn.disabled = false;
                elements.statusMessage.textContent = '设备已连接，可以开始采集';
                
                await 更新状态信息();
                
                // 🆕 显示连接成功信息
                显示状态栏信息('✅', '示波器连接成功', '', 'success', 3000);
            } else {
                显示状态栏信息('❌', '连接失败', result.message, 'error', 4000);
            }
        } catch (error) {
            显示状态栏信息('❌', '连接失败', error.toString(), 'error', 4000);
        }
    }
    
    async function 断开连接() {
        try {
            正在采集 = false;
            const result = await pywebview.api.断开连接();
            
            已连接 = false;
            首次显示波形 = true;  // 重置首次显示标志
            elements.disconnectBtn.disabled = true;
            elements.captureBtn.disabled = true;
            elements.searchBtn.disabled = false;
            elements.memoryDepthSelect.disabled = true;
            elements.timebaseSelect.disabled = true;
            elements.autoSetBtn.disabled = true;
            elements.runBtn.disabled = true;
            elements.stopScopeBtn.disabled = true;
            elements.statusMessage.textContent = '已断开连接';
            
            // 清空状态显示
            elements.sampleRateValue.textContent = '-- Sa/s';
            elements.memoryDepthValue.textContent = '--';
            elements.timebaseValue.textContent = '--';
            
            // 清空波形
            波形数据 = { 时间: [], 电压: [], 时间单位: 'μs', 时间缩放: 1e6 };
            绘制波形();
            
            // 🆕 显示断开连接信息
            显示状态栏信息('ℹ️', '示波器已断开连接', '', 'info', 3000);
        } catch (error) {
            // 忽略断开错误
        }
    }
    
    // ========== 参数设置 ==========
    async function 设置存储深度(e) {
        if (!已连接) return;
        
        try {
            const 之前正在采集 = 正在采集;
            正在采集 = false;
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const result = await pywebview.api.设置存储深度(e.target.value);
            if (result.success) {
                elements.statusMessage.textContent = result.message;
                await new Promise(resolve => setTimeout(resolve, 200));
                await 更新状态信息();
                
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            } else {
                显示状态栏信息('❌', '设置存储深度失败', result.message, 'error', 4000);
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            }
        } catch (error) {
            // 忽略设置错误
        }
    }
    
    async function 设置时基(e) {
        if (!已连接) return;
        
        try {
            const 之前正在采集 = 正在采集;
            正在采集 = false;
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const result = await pywebview.api.设置时基(parseFloat(e.target.value));
            if (result.success) {
                elements.statusMessage.textContent = result.message;
                await new Promise(resolve => setTimeout(resolve, 200));
                await 更新状态信息();
                
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            } else {
                显示状态栏信息('❌', '设置时基失败', result.message, 'error', 4000);
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            }
        } catch (error) {
            // 忽略设置错误
        }
    }
    
    async function 自动设置() {
        try {
            elements.statusMessage.textContent = '正在执行自动设置...';
            elements.autoSetBtn.disabled = true;
            
            const result = await pywebview.api.自动设置();
            
            if (result.success) {
                elements.statusMessage.textContent = result.message;
                await 更新状态信息();
            } else {
                elements.statusMessage.textContent = '自动设置失败';
                显示状态栏信息('❌', '自动设置失败', result.message, 'error', 4000);
            }
        } catch (error) {
            显示状态栏信息('❌', '自动设置失败', error.toString(), 'error', 4000);
        } finally {
            elements.autoSetBtn.disabled = false;
        }
    }
    
    async function 运行示波器() {
        try {
            const result = await pywebview.api.运行示波器();
            if (result.success) {
                elements.statusMessage.textContent = result.message;
            } else {
                显示状态栏信息('❌', '运行示波器失败', result.message, 'error', 4000);
            }
        } catch (error) {
            显示状态栏信息('❌', '运行示波器失败', error.toString(), 'error', 4000);
        }
    }
    
    async function 停止示波器() {
        try {
            const result = await pywebview.api.停止示波器();
            if (result.success) {
                elements.statusMessage.textContent = result.message;
            } else {
                显示状态栏信息('❌', '停止示波器失败', result.message, 'error', 4000);
            }
        } catch (error) {
            显示状态栏信息('❌', '停止示波器失败', error.toString(), 'error', 4000);
        }
    }
    
    async function 更新状态信息() {
        try {
            const result = await pywebview.api.获取完整状态();
            
            if (result.success) {
                elements.sampleRateValue.textContent = CommonUtils.格式化采样率(result.sampleRate);
                elements.memoryDepthValue.textContent = result.memoryDepth;
                elements.timebaseValue.textContent = CommonUtils.格式化时基(result.timebase);
                
                // 更新通道选择（如果有活动通道信息）
                if (result.activeChannel) {
                    elements.channelSelect.value = result.activeChannel;
                    elements.statusChannelValue.textContent = `CHAN${result.activeChannel}`;
                    elements.waveformTitle.textContent = `示波器波形显示 - CHAN${result.activeChannel}`;
                }
            }
        } catch (error) {
            // 忽略状态更新错误
        }
    }
    
    // ========== 波形采集 ==========
    function 开始采集() {
        正在采集 = true;
        elements.captureBtn.disabled = true;
        elements.statusMessage.textContent = '正在采集波形数据...';
        
        连续采集();
    }
    
    async function 连续采集() {
        while (正在采集 && 已连接) {
            try {
                const 通道 = parseInt(elements.channelSelect.value);
                const result = await pywebview.api.获取波形数据(通道);
                
                if (result.success) {
                    // 同步示波器位置(带时间戳保护)
                    const 当前时间 = Date.now();
                    if (当前时间 - 最后操作时间 > 操作保护时间) {
                        try {
                            const posResult = await pywebview.api.获取水平位置();
                            if (posResult.success) {
                                波形显示状态.timeOffset = posResult.offset;
                            }
                        } catch (posError) {
                            // 忽略位置获取错误
                        }
                    }
                    
                    更新波形数据(result.data);
                    elements.statusMessage.textContent = `正在采集 CHAN${通道} 波形...`;
                }
                
                // 每10次采集才更新一次状态信息
                采集计数++;
                if (采集计数 >= 10) {
                    await 更新状态信息();
                    采集计数 = 0;
                }
                
                // 20fps = 50ms 刷新间隔
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                elements.statusMessage.textContent = '采集错误: ' + error;
                正在采集 = false;
                break;
            }
        }
    }
    

    
    function 更新波形数据(data) {
        const 垂直档位 = data.vScale || 1;
        const 垂直偏移 = data.vOffset || 0;
        const 时基档位 = data.hScale || 1e-6;
        const 采样点数 = data.points || data.time.length;
        const 存储深度 = data.memoryDepth;
        
        // 智能选择时间单位（基于实际时间范围）
        let 时间单位, 时间缩放;
        
        // 计算时间范围（秒）
        const 时间数组 = data.time;
        let 最大时间 = 0;
        if (时间数组 && 时间数组.length > 0) {
            最大时间 = Math.max(...时间数组.map(Math.abs));
        }
        
        // 根据最大时间值选择单位
        // 999ns 及以下显示 ns
        if (最大时间 <= 999e-9) {
            时间单位 = 'ns';
            时间缩放 = 1e9;
        }
        // 999ns 以上到 999μs 显示 μs
        else if (最大时间 <= 999e-6) {
            时间单位 = 'μs';
            时间缩放 = 1e6;
        }
        // 999μs 以上到 999ms 显示 ms
        else if (最大时间 <= 999e-3) {
            时间单位 = 'ms';
            时间缩放 = 1e3;
        }
        // 999ms 以上显示 s
        else {
            时间单位 = 's';
            时间缩放 = 1;
        }
        
        波形数据 = {
            时间: data.time,
            电压: data.voltage,
            时间单位: 时间单位,
            时间缩放: 时间缩放,
            垂直档位: 垂直档位,
            垂直偏移: 垂直偏移,
            时基档位: 时基档位,
            采样点数: 采样点数
        };
        
        // 首次显示波形时，同步选项卡到实际值
        if (首次显示波形 && data.time.length > 0) {
            首次显示波形 = false;
            
            // 同步存储深度
            if (存储深度) {
                const 存储深度值 = String(存储深度).toUpperCase().trim();
                for (let i = 0; i < elements.memoryDepthSelect.options.length; i++) {
                    if (elements.memoryDepthSelect.options[i].value.toUpperCase().trim() === 存储深度值) {
                        elements.memoryDepthSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // 同步时基
            if (时基档位) {
                let 最接近索引 = 0;
                let 最小差值 = Infinity;
                
                for (let i = 0; i < elements.timebaseSelect.options.length; i++) {
                    const 选项值 = parseFloat(elements.timebaseSelect.options[i].value);
                    const 差值 = Math.abs(选项值 - 时基档位);
                    
                    if (差值 < 最小差值) {
                        最小差值 = 差值;
                        最接近索引 = i;
                    }
                    
                    if (差值 < 1e-12) break;
                }
                
                elements.timebaseSelect.selectedIndex = 最接近索引;
            }
        }
        
        // 启用保存按钮
        if (elements.saveBtn) {
            elements.saveBtn.disabled = false;
            if (elements.saveDropdownBtn) {
                elements.saveDropdownBtn.disabled = false;
            }
        }
        
        更新垂直档位显示();
        绘制波形();
        
        // 🆕 通知所有订阅者
        通知波形订阅者(波形数据);
    }
    
    function 绘制波形() {
        if (波形数据.时间.length > 0) {
            elements.statusMessage.style.display = 'none';
        }
        
        CommonUtils.绘制波形到画布(canvas, ctx, 波形数据, 波形显示状态);
        
        // 更新通道显示
        const 通道 = elements.channelSelect.value;
        elements.statusChannelValue.textContent = `CHAN${通道}`;
    }
    
    // ========== 波形保存 ==========
    function 切换保存菜单(e) {
        e.stopPropagation();
        elements.saveDropdownMenu.classList.toggle('show');
    }
    
    function 选择保存格式(e) {
        e.stopPropagation();
        当前保存格式 = e.target.dataset.format;
        elements.saveDropdownMenu.classList.remove('show');
        
        if (当前保存格式 === 'csv') {
            elements.saveBtn.innerHTML = '📊 保存为 CSV';
        } else {
            elements.saveBtn.innerHTML = '💾 保存为 NPY';
        }
    }
    
    async function 保存波形(格式 = 'npy') {
        if (!已连接) {
            显示状态栏信息('⚠️', '无法保存', '请先连接示波器', 'warning', 3000);
            return;
        }
        
        try {
            const pathResult = await pywebview.api.选择保存路径(格式);
            
            if (!pathResult.success) {
                if (pathResult.message !== '用户取消了保存') {
                    显示状态栏信息('❌', '选择保存路径失败', pathResult.message, 'error', 4000);
                }
                return;
            }
            
            const filePath = pathResult.path;
            const 通道 = parseInt(elements.channelSelect.value);
            
            const 之前正在采集 = 正在采集;
            正在采集 = false;
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const 格式名称 = 格式.toUpperCase();
            elements.statusMessage.textContent = `正在保存波形为 ${格式名称} 格式（获取完整存储深度数据）...`;
            elements.statusMessage.style.display = 'block';
            elements.saveBtn.disabled = true;
            elements.saveDropdownBtn.disabled = true;
            elements.captureBtn.disabled = true;
            
            const saveResult = await pywebview.api.保存波形到文件(filePath, 通道, 格式);
            
            if (saveResult.success) {
                elements.statusMessage.textContent = '波形保存成功';
                
                // 🆕 显示保存信息
                const 点数匹配 = saveResult.message.match(/采样点数:\s*([\d,]+)/);
                const 点数 = 点数匹配 ? 点数匹配[1] : '';
                显示状态栏信息('✅', '波形保存成功', `${点数} 点数 · ${格式.toUpperCase()}`, 'success', 3000);
            } else {
                elements.statusMessage.textContent = '保存失败';
                显示状态栏信息('❌', '波形保存失败', saveResult.message, 'error', 4000);
            }
            
            if (之前正在采集) {
                正在采集 = true;
                连续采集();
            }
        } catch (error) {
            elements.statusMessage.textContent = '保存失败';
            显示状态栏信息('❌', '波形保存失败', error.toString(), 'error', 4000);
        } finally {
            elements.saveBtn.disabled = false;
            elements.saveDropdownBtn.disabled = false;
        }
    }
    
    // ========== 波形显示控制 ==========
    
    // 水平移动
    function 水平移动(格数) {
        if (波形数据.时间.length === 0) return;
        最后操作时间 = Date.now();
        const 时基档位 = 波形数据.时基档位 || 1e-6;
        波形显示状态.timeOffset += 时基档位 * 格数;
        绘制波形();
        // 🆕 通知订阅者波形显示状态已改变
        通知波形订阅者(波形数据);
        处理水平移动后刷新();
    }
    
    async function 处理水平移动后刷新() {
        if (水平移动定时器) {
            clearTimeout(水平移动定时器);
        }
        
        // 缩短防抖时间：500ms → 200ms
        水平移动定时器 = setTimeout(async () => {
            const timeOffset = 波形显示状态.timeOffset;
            
            try {
                const 通道 = parseInt(elements.channelSelect.value);
                const 之前正在采集 = 正在采集;
                正在采集 = false;
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const result = await pywebview.api.设置水平位置(timeOffset);
                
                if (!result.success) {
                    if (之前正在采集) {
                        正在采集 = true;
                        连续采集();
                    }
                    return;
                }
                
                // 缩短等待时间：200ms → 100ms
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const dataResult = await pywebview.api.获取波形数据(通道);
                
                if (dataResult.success) {
                    更新波形数据(dataResult.data);
                    
                    if (之前正在采集) {
                        正在采集 = true;
                        连续采集();
                    }
                }
            } catch (error) {
                // 确保恢复采集
                if (正在采集 === false && 已连接) {
                    正在采集 = true;
                    连续采集();
                }
            }
        }, 200);
    }
    
    async function 水平回中() {
        最后操作时间 = Date.now();
        波形显示状态.timeOffset = 0;
        绘制波形();
        // 🆕 通知订阅者波形显示状态已改变
        通知波形订阅者(波形数据);
        
        if (已连接) {
            try {
                const 通道 = parseInt(elements.channelSelect.value);
                const 之前正在采集 = 正在采集;
                正在采集 = false;
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const result = await pywebview.api.设置水平位置(0);
                if (!result.success) {
                    if (之前正在采集) {
                        正在采集 = true;
                        连续采集();
                    }
                    return;
                }
                
                // 缩短等待时间：200ms → 100ms
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const dataResult = await pywebview.api.获取波形数据(通道);
                if (dataResult.success) {
                    更新波形数据(dataResult.data);
                }
                
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            } catch (error) {
                // 确保恢复采集
                if (正在采集 === false && 已连接) {
                    正在采集 = true;
                    连续采集();
                }
            }
        }
    }
    
    // 垂直居中
    async function 垂直回中() {
        波形显示状态.voltageOffset = 0;
        绘制波形();
        // 🆕 通知订阅者波形显示状态已改变
        通知波形订阅者(波形数据);
        
        if (已连接) {
            try {
                const 通道 = parseInt(elements.channelSelect.value);
                const 之前正在采集 = 正在采集;
                正在采集 = false;
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const result = await pywebview.api.设置垂直位置(通道, 0);
                if (!result.success) {
                    if (之前正在采集) {
                        正在采集 = true;
                        连续采集();
                    }
                    return;
                }
                
                // 缩短等待时间：200ms → 100ms
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const dataResult = await pywebview.api.获取波形数据(通道);
                if (dataResult.success) {
                    更新波形数据(dataResult.data);
                }
                
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            } catch (error) {
                // 确保恢复采集
                if (正在采集 === false && 已连接) {
                    正在采集 = true;
                    连续采集();
                }
            }
        }
    }
    
    // 切换微调模式
    function 切换微调模式() {
        微调模式 = !微调模式;
        
        // 更新按钮样式
        if (微调模式) {
            elements.vFineTuneBtn.classList.add('fine-tune-active');
            显示微调提示('微调: 打开');
        } else {
            elements.vFineTuneBtn.classList.remove('fine-tune-active');
            显示微调提示('微调: 关闭');
        }
    }
    
    // 显示状态栏信息（统一函数）
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
        elements.statusBarInfoPanel.classList.remove('success', 'info', 'warning', 'error');
        
        // 添加对应类型的类
        elements.statusBarInfoPanel.classList.add(类型);
        
        // 显示面板
        elements.statusBarInfoPanel.style.display = 'flex';
        
        // 指定时间后自动隐藏
        setTimeout(() => {
            elements.statusBarInfoPanel.style.display = 'none';
        }, 持续时间);
    }
    
    // 显示Toast提示（通用）
    function 显示Toast提示(文本, 持续时间 = 2000) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = 文本;
        
        // 添加到body
        document.body.appendChild(toast);
        
        // 触发动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 指定时间后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 300);
        }, 持续时间);
    }
    
    // 显示微调提示
    function 显示微调提示(文本) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'fine-tune-toast';
        toast.textContent = 文本;
        
        // 添加到canvas容器
        const container = canvas.parentElement;
        container.appendChild(toast);
        
        // 2秒后移除
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 2000);
    }
    
    // 垂直灵敏度调整（按标准档位序列，调用示波器SCPI命令）
    function 垂直缩放(方向) {
        if (!已连接) return;
        
        // 微调模式
        if (微调模式) {
            垂直微调(方向);
            return;
        }
        
        // 初始化当前档位索引
        if (波形显示状态.当前垂直档位索引 === null) {
            const 当前档位 = 波形显示状态.显示垂直档位 || 波形数据.垂直档位 || 1;
            // 找到最接近的档位索引
            波形显示状态.当前垂直档位索引 = 找到最接近档位索引(当前档位);
        }
        
        // 调整档位索引
        if (方向 > 0) {
            // + 按钮：增大档位值（1V→2V）
            if (波形显示状态.当前垂直档位索引 < 垂直档位序列.length - 1) {
                波形显示状态.当前垂直档位索引++;
            } else {
                // 已经是最大档位，显示警告
                显示状态栏信息('⚠️', '已达到最大垂直档位', '10V/div', 'warning', 2000);
                return;
            }
        } else {
            // - 按钮：减小档位值（1V→500mV）
            if (波形显示状态.当前垂直档位索引 > 0) {
                波形显示状态.当前垂直档位索引--;
            } else {
                // 已经是最小档位，显示警告
                显示状态栏信息('⚠️', '已达到最小垂直档位', '10mV/div', 'warning', 2000);
                return;
            }
        }
        
        // 获取新档位值
        const 新档位 = 垂直档位序列[波形显示状态.当前垂直档位索引];
        
        // 立即更新显示档位
        波形显示状态.显示垂直档位 = 新档位;
        更新垂直档位显示();
        绘制波形();
        // 通知订阅者波形显示状态已改变
        通知波形订阅者(波形数据);
        
        处理垂直缩放后刷新();
    }
    
    async function 处理垂直缩放后刷新() {
        if (垂直缩放定时器) {
            clearTimeout(垂直缩放定时器);
        }
        
        // 防抖时间：200ms
        垂直缩放定时器 = setTimeout(async () => {
            const 新档位 = 波形显示状态.显示垂直档位;
            
            try {
                const 通道 = parseInt(elements.channelSelect.value);
                const 之前正在采集 = 正在采集;
                正在采集 = false;
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const result = await pywebview.api.设置垂直灵敏度(通道, 新档位);
                
                if (!result.success) {
                    if (之前正在采集) {
                        正在采集 = true;
                        连续采集();
                    }
                    return;
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const dataResult = await pywebview.api.获取波形数据(通道);
                
                if (dataResult.success) {
                    更新波形数据(dataResult.data);
                    
                    if (之前正在采集) {
                        正在采集 = true;
                        连续采集();
                    }
                }
            } catch (error) {
                // 确保恢复采集
                if (正在采集 === false && 已连接) {
                    正在采集 = true;
                    连续采集();
                }
            }
        }, 200);
    }
    
    // 垂直微调（连续调整，不按档位序列）
    function 垂直微调(方向) {
        if (!已连接) return;
        
        // 使用缓存的档位值，避免每次都查询
        let 当前档位 = 波形显示状态.显示垂直档位 || 波形数据.垂直档位 || 1;
        let 调整量;
        
        // 根据当前档位决定调整量
        if (当前档位 >= 1) {
            // 1V及以上：每次调整0.05V
            调整量 = 0.05;
        } else {
            // 1V以下：每次调整5mV (0.005V)
            调整量 = 0.005;
        }
        
        // 计算新档位
        let 新档位;
        if (方向 > 0) {
            新档位 = 当前档位 + 调整量;
        } else {
            新档位 = 当前档位 - 调整量;
        }
        
        // 限制范围：10mV ~ 10V，并检测边界
        const 原档位 = 新档位;
        新档位 = Math.max(0.01, Math.min(10, 新档位));
        
        // 检测是否达到边界
        if (原档位 > 10 && 新档位 === 10) {
            显示状态栏信息('⚠️', '已达到最大垂直档位', '10V/div', 'warning', 2000);
        } else if (原档位 < 0.01 && 新档位 === 0.01) {
            显示状态栏信息('⚠️', '已达到最小垂直档位', '10mV/div', 'warning', 2000);
        }
        
        // 四舍五入到合理精度
        新档位 = Math.round(新档位 * 1000) / 1000;
        
        // 立即更新显示状态
        波形显示状态.显示垂直档位 = 新档位;
        波形显示状态.当前垂直档位索引 = null;
        更新垂直档位显示();
        绘制波形();
        // 通知订阅者波形显示状态已改变
        通知波形订阅者(波形数据);
        
        处理垂直缩放后刷新();
    }
    
    // 找到最接近的档位索引
    function 找到最接近档位索引(目标档位) {
        let 最小差值 = Infinity;
        let 最接近索引 = 6; // 默认1V（索引6）
        
        for (let i = 0; i < 垂直档位序列.length; i++) {
            const 差值 = Math.abs(垂直档位序列[i] - 目标档位);
            if (差值 < 最小差值) {
                最小差值 = 差值;
                最接近索引 = i;
            }
        }
        
        return 最接近索引;
    }
    
    function 更新垂直档位显示() {
        const 显示档位 = 波形显示状态.显示垂直档位 || 波形数据.垂直档位 || 1;
        
        if (显示档位 >= 1) {
            elements.vScaleValue.textContent = `${显示档位.toFixed(0)} V/div`;
        } else {
            elements.vScaleValue.textContent = `${(显示档位 * 1000).toFixed(0)} mV/div`;
        }
    }
    
    // 滚轮缩放（调整垂直灵敏度）
    function 滚轮缩放(e) {
        if (波形数据.时间.length === 0) return;
        
        e.preventDefault();
        
        if (e.deltaY < 0) {
            // 向上滚动 - 增加灵敏度
            垂直缩放(1);
        } else {
            // 向下滚动 - 减小灵敏度
            垂直缩放(-1);
        }
    }
    
    // 恢复默认视图
    async function 恢复默认视图() {
        波形显示状态.timeOffset = 0;
        波形显示状态.voltageOffset = 0;
        波形显示状态.当前垂直档位索引 = null;
        波形显示状态.显示垂直档位 = null;
        
        更新垂直档位显示();
        绘制波形();
        // 🆕 通知订阅者波形显示状态已改变
        通知波形订阅者(波形数据);
        
        if (已连接) {
            try {
                const 之前正在采集 = 正在采集;
                正在采集 = false;
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const 通道 = parseInt(elements.channelSelect.value);
                
                await Promise.all([
                    pywebview.api.设置水平位置(0),
                    pywebview.api.设置垂直位置(通道, 0)
                ]);
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const dataResult = await pywebview.api.获取波形数据(通道);
                if (dataResult.success) {
                    更新波形数据(dataResult.data);
                }
                
                if (之前正在采集) {
                    正在采集 = true;
                    连续采集();
                }
            } catch (error) {
                // 忽略恢复错误
            }
        }
    }
    
    // ========== 订阅管理（发布-订阅模式）==========
    function 订阅波形更新(回调函数) {
        if (typeof 回调函数 === 'function') {
            波形订阅者列表.push(回调函数);
        }
    }
    
    function 取消订阅波形更新(回调函数) {
        const 索引 = 波形订阅者列表.indexOf(回调函数);
        if (索引 > -1) {
            波形订阅者列表.splice(索引, 1);
        }
    }
    
    function 通知波形订阅者(波形) {
        波形订阅者列表.forEach(回调 => {
            try {
                // 🆕 传递波形数据和显示状态
                回调({
                    波形数据: 波形,
                    显示状态: {
                        timeOffset: 波形显示状态.timeOffset,
                        voltageOffset: 波形显示状态.voltageOffset,
                        显示垂直档位: 波形显示状态.显示垂直档位
                    }
                });
            } catch (error) {
                // 静默处理订阅者错误
            }
        });
    }
    
    // ========== RAW数据获取（高精度数据）==========
    async function 获取当前RAW波形() {
        /**
         * 获取当前的RAW模式波形数据（12bit精度，完整存储深度）
         * 用于单轴应力检测模块保存高精度数据
         * 
         * 返回: Promise<{success: bool, data: {...}}>
         */
        if (!已连接) {
            return {
                success: false,
                message: "示波器未连接"
            };
        }
        
        try {
            // 暂停实时采集
            const 之前正在采集 = 正在采集;
            正在采集 = false;
            
            // 等待当前采集循环结束
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 获取RAW模式数据
            const 通道 = parseInt(elements.channelSelect.value);
            const result = await pywebview.api.获取RAW波形数据(通道);
            
            // 恢复实时采集
            if (之前正在采集) {
                正在采集 = true;
                连续采集();
            }
            
            return result;
        } catch (error) {
            // 确保恢复采集
            if (!正在采集 && 已连接) {
                正在采集 = true;
                连续采集();
            }
            
            return {
                success: false,
                message: `获取RAW数据失败: ${error}`
            };
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        获取连接状态: () => 已连接,
        获取采集状态: () => 正在采集,
        获取波形数据: () => 波形数据,
        获取当前RAW波形,    // 🆕 获取高精度RAW数据
        重绘波形: 绘制波形,
        订阅波形更新,      // 🆕 订阅接口
        取消订阅波形更新   // 🆕 取消订阅接口
    };
})();
