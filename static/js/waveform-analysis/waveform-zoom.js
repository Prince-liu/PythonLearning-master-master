// ==================== 波形缩放模块 ====================
// 负责框选放大、拖动、滚轮缩放、重置等功能

const WaveformZoom = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let canvas;
    let 框选模式 = false;
    let 框选起点 = null;
    let 框选终点 = null;
    let 正在框选 = false;
    let 缩放历史 = [];
    let 当前缩放范围 = null;
    
    // 拖动模式相关
    let 拖动模式 = false;
    let 正在拖动 = false;
    let 拖动起点 = null;
    let 拖动前的缩放范围 = null;
    
    // 回调函数
    let 重绘回调 = null;
    let 状态回调 = null;
    let 获取波形数据回调 = null;
    let 显示状态栏信息回调 = null;
    
    // UI 元素
    let zoomInBtn = null;
    let panBtn = null;
    
    // ========== 初始化函数 ==========
    function 初始化(canvasElement, 配置) {
        canvas = canvasElement;
        重绘回调 = 配置.重绘回调;
        状态回调 = 配置.状态回调;
        获取波形数据回调 = 配置.获取波形数据回调;
        显示状态栏信息回调 = 配置.显示状态栏信息回调;
        zoomInBtn = 配置.zoomInBtn;
        panBtn = 配置.panBtn;
        
        // 绑定鼠标事件
        canvas.addEventListener('mousedown', 处理鼠标按下);
        canvas.addEventListener('mousemove', 处理鼠标移动);
        canvas.addEventListener('mouseup', 处理鼠标释放);
        canvas.addEventListener('mouseleave', 处理鼠标离开);
        canvas.addEventListener('wheel', 处理滚轮缩放, { passive: false });
    }
    
    // ========== 启用/禁用框选模式 ==========
    function 启用框选放大() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法启用框选放大', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        // 关闭拖动模式
        if (拖动模式) {
            拖动模式 = false;
            if (panBtn) {
                panBtn.classList.remove('active');
            }
        }
        
        框选模式 = !框选模式;
        
        if (框选模式) {
            canvas.style.cursor = 'crosshair';
            if (zoomInBtn) {
                zoomInBtn.classList.add('active');
            }
            状态回调('框选放大模式已启用 - 拖动鼠标选择区域');
        } else {
            canvas.style.cursor = 'default';
            if (zoomInBtn) {
                zoomInBtn.classList.remove('active');
            }
            状态回调('框选放大模式已关闭');
        }
        
        setTimeout(() => 状态回调(''), 2000);
    }
    
    // ========== 启用/禁用拖动模式 ==========
    function 启用拖动模式() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法启用拖动模式', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        // 关闭框选模式
        if (框选模式) {
            框选模式 = false;
            if (zoomInBtn) {
                zoomInBtn.classList.remove('active');
            }
        }
        
        拖动模式 = !拖动模式;
        
        if (拖动模式) {
            canvas.style.cursor = 'grab';
            if (panBtn) {
                panBtn.classList.add('active');
            }
            状态回调('拖动模式已启用 - 按住鼠标拖动波形');
        } else {
            canvas.style.cursor = 'default';
            if (panBtn) {
                panBtn.classList.remove('active');
            }
            状态回调('拖动模式已关闭');
        }
        
        setTimeout(() => 状态回调(''), 2000);
    }
    
    // ========== 鼠标事件处理 ==========
    function 处理鼠标按下(event) {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) return;
        
        const rect = canvas.getBoundingClientRect();
        
        // 框选模式
        if (框选模式) {
            框选起点 = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            正在框选 = true;
        }
        
        // 拖动模式
        if (拖动模式) {
            拖动起点 = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            拖动前的缩放范围 = 当前缩放范围 ? {...当前缩放范围} : null;
            正在拖动 = true;
            canvas.style.cursor = 'grabbing';
        }
    }
    
    function 处理鼠标移动(event) {
        const rect = canvas.getBoundingClientRect();
        
        // 框选模式
        if (正在框选 && 框选起点) {
            框选终点 = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            // 触发重绘，显示选择框
            重绘回调({ 框选起点, 框选终点 });
        }
        
        // 拖动模式
        if (正在拖动 && 拖动起点) {
            const 当前位置 = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            应用拖动偏移(当前位置);
        }
    }
    
    function 处理鼠标释放(event) {
        // 框选模式
        if (正在框选 && 框选起点) {
            const rect = canvas.getBoundingClientRect();
            框选终点 = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            正在框选 = false;
            
            // 应用缩放
            应用框选缩放();
            
            // 清除选择框，但保持框选模式开启
            框选起点 = null;
            框选终点 = null;
            
            // 保持框选模式和鼠标样式
            if (框选模式) {
                canvas.style.cursor = 'crosshair';
            }
        }
        
        // 拖动模式
        if (正在拖动) {
            正在拖动 = false;
            拖动起点 = null;
            拖动前的缩放范围 = null;
            
            if (拖动模式) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    }
    
    function 处理鼠标离开() {
        if (正在框选) {
            正在框选 = false;
            框选起点 = null;
            框选终点 = null;
            重绘回调();
        }
        
        if (正在拖动) {
            正在拖动 = false;
            拖动起点 = null;
            拖动前的缩放范围 = null;
            
            if (拖动模式) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    }
    
    // ========== 应用拖动偏移 ==========
    function 应用拖动偏移(当前位置) {
        const 波形数据 = 获取波形数据回调();
        if (!拖动起点 || !波形数据) return;
        
        const rect = canvas.getBoundingClientRect();
        const padding = { top: 30, right: 80, bottom: 60, left: 50 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;
        
        // 计算鼠标移动的像素距离
        const dx = 当前位置.x - 拖动起点.x;
        const dy = 当前位置.y - 拖动起点.y;
        
        // 获取当前数据范围
        let 时间最小, 时间最大, 电压最小, 电压最大;
        
        if (拖动前的缩放范围) {
            时间最小 = 拖动前的缩放范围.时间最小;
            时间最大 = 拖动前的缩放范围.时间最大;
            电压最小 = 拖动前的缩放范围.电压最小;
            电压最大 = 拖动前的缩放范围.电压最大;
        } else {
            const 时间 = 波形数据.time;
            const 电压 = 波形数据.voltage;
            时间最小 = Math.min(...时间);
            时间最大 = Math.max(...时间);
            电压最小 = Math.min(...电压);
            电压最大 = Math.max(...电压);
        }
        
        // 计算数据范围的偏移量（注意方向）
        const 时间范围 = 时间最大 - 时间最小;
        const 电压范围 = 电压最大 - 电压最小;
        const 时间偏移 = -(dx / chartWidth) * 时间范围;
        const 电压偏移 = (dy / chartHeight) * 电压范围;
        
        // 应用偏移
        当前缩放范围 = {
            时间最小: 时间最小 + 时间偏移,
            时间最大: 时间最大 + 时间偏移,
            电压最小: 电压最小 + 电压偏移,
            电压最大: 电压最大 + 电压偏移
        };
        
        重绘回调();
    }
    
    // ========== 应用框选缩放 ==========
    function 应用框选缩放() {
        const 波形数据 = 获取波形数据回调();
        if (!框选起点 || !框选终点 || !波形数据) return;
        
        const rect = canvas.getBoundingClientRect();
        const padding = { top: 30, right: 80, bottom: 60, left: 50 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;
        
        const x1 = Math.min(框选起点.x, 框选终点.x) - padding.left;
        const x2 = Math.max(框选起点.x, 框选终点.x) - padding.left;
        const y1 = Math.min(框选起点.y, 框选终点.y) - padding.top;
        const y2 = Math.max(框选起点.y, 框选终点.y) - padding.top;
        
        // 检查选择框是否在有效范围内
        if (x1 < 0 || x2 > chartWidth || y1 < 0 || y2 > chartHeight) {
            状态回调('选择区域超出图表范围');
            setTimeout(() => 状态回调(''), 2000);
            return;
        }
        
        // 检查选择框大小
        if (Math.abs(x2 - x1) < 20 || Math.abs(y2 - y1) < 20) {
            状态回调('选择区域太小');
            setTimeout(() => 状态回调(''), 2000);
            return;
        }
        
        // 保存当前缩放范围到历史
        if (当前缩放范围) {
            缩放历史.push({...当前缩放范围});
        } else {
            // 第一次缩放，保存原始范围
            const 时间 = 波形数据.time;
            const 电压 = 波形数据.voltage;
            缩放历史.push({
                时间最小: Math.min(...时间),
                时间最大: Math.max(...时间),
                电压最小: Math.min(...电压),
                电压最大: Math.max(...电压)
            });
        }
        
        // 计算新的数据范围
        const 当前时间最小 = 当前缩放范围 ? 当前缩放范围.时间最小 : 缩放历史[0].时间最小;
        const 当前时间最大 = 当前缩放范围 ? 当前缩放范围.时间最大 : 缩放历史[0].时间最大;
        const 当前电压最小 = 当前缩放范围 ? 当前缩放范围.电压最小 : 缩放历史[0].电压最小;
        const 当前电压最大 = 当前缩放范围 ? 当前缩放范围.电压最大 : 缩放历史[0].电压最大;
        
        const 新时间最小 = 当前时间最小 + (当前时间最大 - 当前时间最小) * (x1 / chartWidth);
        const 新时间最大 = 当前时间最小 + (当前时间最大 - 当前时间最小) * (x2 / chartWidth);
        const 新电压最大 = 当前电压最大 - (当前电压最大 - 当前电压最小) * (y1 / chartHeight);
        const 新电压最小 = 当前电压最大 - (当前电压最大 - 当前电压最小) * (y2 / chartHeight);
        
        当前缩放范围 = {
            时间最小: 新时间最小,
            时间最大: 新时间最大,
            电压最小: 新电压最小,
            电压最大: 新电压最大
        };
        
        重绘回调();
        状态回调('已放大选中区域');
        setTimeout(() => 状态回调(''), 2000);
    }
    
    // ========== 鼠标滚轮缩放 ==========
    function 处理滚轮缩放(event) {
        event.preventDefault();
        
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) return;
        
        const rect = canvas.getBoundingClientRect();
        const padding = { top: 30, right: 80, bottom: 60, left: 50 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;
        
        // 获取鼠标在canvas中的位置
        const mouseX = event.clientX - rect.left - padding.left;
        const mouseY = event.clientY - rect.top - padding.top;
        
        // 检查鼠标是否在图表区域内
        if (mouseX < 0 || mouseX > chartWidth || mouseY < 0 || mouseY > chartHeight) {
            return;
        }
        
        // 获取当前数据范围
        let 时间最小, 时间最大, 电压最小, 电压最大;
        
        if (当前缩放范围) {
            时间最小 = 当前缩放范围.时间最小;
            时间最大 = 当前缩放范围.时间最大;
            电压最小 = 当前缩放范围.电压最小;
            电压最大 = 当前缩放范围.电压最大;
        } else {
            const 时间 = 波形数据.time;
            const 电压 = 波形数据.voltage;
            时间最小 = Math.min(...时间);
            时间最大 = Math.max(...时间);
            电压最小 = Math.min(...电压);
            电压最大 = Math.max(...电压);
        }
        
        // 计算鼠标位置对应的数据值
        const 时间范围 = 时间最大 - 时间最小;
        const 电压范围 = 电压最大 - 电压最小;
        const 鼠标时间 = 时间最小 + (mouseX / chartWidth) * 时间范围;
        const 鼠标电压 = 电压最大 - (mouseY / chartHeight) * 电压范围;
        
        // 缩放因子（向上滚动放大，向下滚动缩小）
        const 缩放系数 = event.deltaY < 0 ? 0.9 : 1.1;
        
        // 计算新的范围（以鼠标位置为中心缩放）
        const 新时间范围 = 时间范围 * 缩放系数;
        const 新电压范围 = 电压范围 * 缩放系数;
        
        // 计算鼠标位置在新范围中的比例
        const 时间比例 = (鼠标时间 - 时间最小) / 时间范围;
        const 电压比例 = (鼠标电压 - 电压最小) / 电压范围;
        
        // 应用新的缩放范围
        当前缩放范围 = {
            时间最小: 鼠标时间 - 新时间范围 * 时间比例,
            时间最大: 鼠标时间 + 新时间范围 * (1 - 时间比例),
            电压最小: 鼠标电压 - 新电压范围 * 电压比例,
            电压最大: 鼠标电压 + 新电压范围 * (1 - 电压比例)
        };
        
        重绘回调();
    }
    
    // ========== 重置视图 ==========
    function 重置视图() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法重置视图', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        缩放历史 = [];
        当前缩放范围 = null;
        重绘回调();
        状态回调('已重置视图');
        setTimeout(() => 状态回调(''), 2000);
    }
    
    // ========== 清除缩放状态 ==========
    function 清除缩放状态() {
        框选模式 = false;
        框选起点 = null;
        框选终点 = null;
        正在框选 = false;
        拖动模式 = false;
        正在拖动 = false;
        拖动起点 = null;
        拖动前的缩放范围 = null;
        缩放历史 = [];
        当前缩放范围 = null;
        
        if (canvas) {
            canvas.style.cursor = 'default';
        }
        if (zoomInBtn) {
            zoomInBtn.classList.remove('active');
        }
        if (panBtn) {
            panBtn.classList.remove('active');
        }
    }
    
    // ========== 获取当前状态 ==========
    function 获取缩放范围() {
        return 当前缩放范围;
    }
    
    function 是否正在框选() {
        return 正在框选;
    }
    
    function 获取框选坐标() {
        return { 框选起点, 框选终点 };
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        启用框选放大,
        启用拖动模式,
        重置视图,
        清除缩放状态,
        获取缩放范围,
        是否正在框选,
        获取框选坐标
    };
})();
