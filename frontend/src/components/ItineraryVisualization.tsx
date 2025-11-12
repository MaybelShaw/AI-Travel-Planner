import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  Avatar,
  Divider,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  Hotel,
  Restaurant,
  AttractionsOutlined,
  DirectionsBus,
  ExpandMore,
  ExpandLess,
  Schedule,
  LocationOn,
  AttachMoney,
  Edit,
  Map,
  Refresh,
} from '@mui/icons-material';
import { TravelPlan, RoutePoint } from '../types';
import TravelMap from './TravelMap';

interface ItineraryVisualizationProps {
  travelPlan: TravelPlan;
  onEdit?: (planId: number) => void;
  onViewMap?: (planId: number) => void;
  showMap?: boolean;
}

interface DaySchedule {
  day: number;
  date: string;
  theme?: string;
  overview?: string;
  accommodation?: {
    name: string;
    coordinates?: { latitude: number; longitude: number };
  };
  transportation?: Array<{
    from: string;
    to: string;
    route_details?: { line: string; cost: number };
  }>;
  activities?: Array<{
    name: string;
    location?: { coordinates?: { latitude: number; longitude: number } };
    cost?: number;
    time?: string;
  }>;
  daily_summary?: {
    total_cost: number;
  };
}

const ItineraryVisualization: React.FC<ItineraryVisualizationProps> = ({
  travelPlan,
  onEdit,
  onViewMap,
  showMap = false,
}) => {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [showMapView, setShowMapView] = useState(showMap);

  // 解析行程数据
  const itineraryData = useMemo(() => {
    try {
      if (typeof travelPlan.itinerary === 'string') {
        return JSON.parse(travelPlan.itinerary);
      }
      return travelPlan.itinerary;
    } catch (error) {
      console.error('解析行程数据失败:', error);
      return null;
    }
  }, [travelPlan.itinerary]);

  // 获取基本信息
  const basicInfo = itineraryData?.basic_info || {};
  const dailySchedule: DaySchedule[] = itineraryData?.itinerary || [];

  // 生成地图路线点
  const routePoints = useMemo((): RoutePoint[] => {
    const points: RoutePoint[] = [];
    let order = 0;

    dailySchedule.forEach((day) => {
      // 住宿点
      if (day.accommodation?.coordinates) {
        points.push({
          ...day.accommodation.coordinates,
          name: day.accommodation.name,
          type: 'accommodation',
          order: order++,
        });
      }

      // 活动点
      day.activities?.forEach((activity) => {
        if (activity.location?.coordinates) {
          points.push({
            ...activity.location.coordinates,
            name: activity.name,
            type: 'attraction',
            order: order++,
          });
        }
      });
    });

    return points;
  }, [dailySchedule]);

  // 切换日程展开状态
  const toggleDayExpansion = (day: number) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    setExpandedDays(newExpanded);
  };

  // 获取活动图标
  const getActivityIcon = (activityName: string) => {
    const name = activityName.toLowerCase();
    if (name.includes('酒店') || name.includes('住宿')) return <Hotel />;
    if (name.includes('餐') || name.includes('食')) return <Restaurant />;
    if (name.includes('交通') || name.includes('车') || name.includes('站')) return <DirectionsBus />;
    return <AttractionsOutlined />;
  };

  // 获取活动颜色
  const getActivityColor = (activityName: string) => {
    const name = activityName.toLowerCase();
    if (name.includes('酒店') || name.includes('住宿')) return 'success';
    if (name.includes('餐') || name.includes('食')) return 'warning';
    if (name.includes('交通') || name.includes('车') || name.includes('站')) return 'info';
    return 'primary';
  };

  if (!itineraryData) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" color="error" gutterBottom>
          无法解析行程数据
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          行程数据格式不正确，请尝试重新生成计划。
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => window.location.reload()}
        >
          刷新页面
        </Button>
      </Paper>
    );
  }

  // 如果数据包含raw_content，说明AI返回的不是标准JSON格式
  if (itineraryData.raw_content && !itineraryData.itinerary?.length) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {itineraryData.title || travelPlan.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {itineraryData.summary || "AI生成的行程内容"}
        </Typography>
        
        <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
          <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {itineraryData.raw_content}
          </Typography>
        </Paper>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          此行程内容为AI原始输出格式。如需更好的显示效果，请尝试重新生成计划。
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
          >
            重新生成
          </Button>
          {onEdit && (
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={() => onEdit(travelPlan.id)}
            >
              编辑计划
            </Button>
          )}
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      {/* 行程概览 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              {itineraryData.title || travelPlan.title}
            </Typography>
            {itineraryData.summary && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {itineraryData.summary}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Map />}
              onClick={() => setShowMapView(!showMapView)}
            >
              {showMapView ? '隐藏地图' : '显示地图'}
            </Button>
            {onEdit && (
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => onEdit(travelPlan.id)}
              >
                编辑
              </Button>
            )}
          </Box>
        </Box>

        {/* 基本信息 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <LocationOn color="primary" />
            <Typography variant="body2" color="text.secondary">
              目的地
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {basicInfo.destination || '未知'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Schedule color="primary" />
            <Typography variant="body2" color="text.secondary">
              天数
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {basicInfo.duration_days || dailySchedule.length} 天
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <AttachMoney color="primary" />
            <Typography variant="body2" color="text.secondary">
              预算 / 预计花费
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              ¥{basicInfo.user_budget || travelPlan.budget_limit || 0}
            </Typography>
            {basicInfo.estimated_cost && (
              <Typography variant="caption" color="text.secondary">
                预计: ¥{basicInfo.estimated_cost}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <AttractionsOutlined color="primary" />
            <Typography variant="body2" color="text.secondary">
              活动数量
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {dailySchedule.reduce((total, day) => total + (day.activities?.length || 0), 0)}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* 预算分解 */}
      {itineraryData.budget_breakdown && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            预算分解
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            {/* 预算对比 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                预算对比
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">用户预算:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  ¥{itineraryData.budget_breakdown.user_budget || travelPlan.budget_limit || 0}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">预计花费:</Typography>
                <Typography variant="body2" fontWeight="bold" color={
                  (itineraryData.budget_breakdown.estimated_total || 0) > (itineraryData.budget_breakdown.user_budget || travelPlan.budget_limit || 0) 
                    ? 'error.main' : 'success.main'
                }>
                  ¥{itineraryData.budget_breakdown.estimated_total || 0}
                </Typography>
              </Box>
              {itineraryData.budget_breakdown.budget_status && (
                <Chip 
                  label={itineraryData.budget_breakdown.budget_status}
                  color={
                    itineraryData.budget_breakdown.budget_status === '充足' ? 'success' :
                    itineraryData.budget_breakdown.budget_status === '紧张' ? 'warning' : 'error'
                  }
                  size="small"
                />
              )}
            </Box>

            {/* 费用分类 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                费用分类
              </Typography>
              {[
                { key: 'accommodation', label: '住宿' },
                { key: 'transportation', label: '交通' },
                { key: 'food', label: '餐饮' },
                { key: 'activities', label: '活动' },
                { key: 'shopping', label: '购物' },
                { key: 'other', label: '其他' }
              ].map(({ key, label }) => (
                itineraryData.budget_breakdown[key] ? (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{label}:</Typography>
                    <Typography variant="body2">¥{itineraryData.budget_breakdown[key]}</Typography>
                  </Box>
                ) : null
              ))}
            </Box>
          </Box>

          {/* 节省建议 */}
          {itineraryData.budget_breakdown.savings_tips && itineraryData.budget_breakdown.savings_tips.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                💡 节省建议
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {itineraryData.budget_breakdown.savings_tips.map((tip: string, index: number) => (
                  <Typography key={index} variant="body2" color="text.secondary">
                    • {tip}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* 地图视图 */}
      {showMapView && routePoints.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            行程地图
          </Typography>
          <TravelMap
            height={400}
            routePoints={routePoints}
            center={routePoints.length > 0 ? [routePoints[0].latitude, routePoints[0].longitude] : undefined}
            zoom={12}
            showRoute={true}
            editable={false}
          />
        </Paper>
      )}

      {/* 详细行程 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          详细行程
        </Typography>

        <Timeline>
          {dailySchedule.map((day, index) => (
            <TimelineItem key={day.day}>
              <TimelineSeparator>
                <TimelineDot color="primary" variant="outlined">
                  <Typography variant="caption" fontWeight="bold">
                    {day.day}
                  </Typography>
                </TimelineDot>
                {index < dailySchedule.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              
              <TimelineContent>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    {/* 日期标题 */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleDayExpansion(day.day)}
                    >
                      <Box>
                        <Typography variant="h6" component="div">
                          第 {day.day} 天
                          {day.date && (
                            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                              ({day.date})
                            </Typography>
                          )}
                        </Typography>
                        {day.theme && (
                          <Chip label={day.theme} size="small" color="primary" variant="outlined" />
                        )}
                      </Box>
                      <IconButton>
                        {expandedDays.has(day.day) ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>

                    {/* 概览 */}
                    {day.overview && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {day.overview}
                      </Typography>
                    )}

                    {/* 展开内容 */}
                    <Collapse in={expandedDays.has(day.day)}>
                      <Box sx={{ mt: 2 }}>
                        {/* 住宿信息 */}
                        {day.accommodation && (
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Avatar sx={{ bgcolor: 'success.main', width: 24, height: 24, mr: 1 }}>
                                <Hotel sx={{ fontSize: 14 }} />
                              </Avatar>
                              <Typography variant="subtitle2">住宿</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ ml: 4 }}>
                              {day.accommodation.name}
                            </Typography>
                          </Box>
                        )}

                        {/* 交通信息 */}
                        {day.transportation && day.transportation.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Avatar sx={{ bgcolor: 'info.main', width: 24, height: 24, mr: 1 }}>
                                <DirectionsBus sx={{ fontSize: 14 }} />
                              </Avatar>
                              <Typography variant="subtitle2">交通</Typography>
                            </Box>
                            {day.transportation.map((transport, idx) => (
                              <Box key={idx} sx={{ ml: 4, mb: 1 }}>
                                <Typography variant="body2">
                                  {transport.from} → {transport.to}
                                  {transport.route_details && (
                                    <>
                                      <br />
                                      <Typography variant="caption" color="text.secondary">
                                        {transport.route_details.line} - ¥{transport.route_details.cost}
                                      </Typography>
                                    </>
                                  )}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* 活动安排 */}
                        {day.activities && day.activities.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Avatar sx={{ bgcolor: 'primary.main', width: 24, height: 24, mr: 1 }}>
                                <AttractionsOutlined sx={{ fontSize: 14 }} />
                              </Avatar>
                              <Typography variant="subtitle2">活动安排</Typography>
                            </Box>
                            {day.activities.map((activity, idx) => (
                              <Box key={idx} sx={{ ml: 4, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ flex: 1 }}>
                                  {activity.name}
                                  {activity.cost && (
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                      (¥{activity.cost})
                                    </Typography>
                                  )}
                                </Typography>
                                {activity.time && (
                                  <Chip label={activity.time} size="small" variant="outlined" />
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* 日总结 */}
                        {day.daily_summary && (
                          <>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                当日预计花费
                              </Typography>
                              <Typography variant="body1" fontWeight="bold" color="primary">
                                ¥{day.daily_summary.total_cost}
                              </Typography>
                            </Box>
                          </>
                        )}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Paper>
    </Box>
  );
};

export default ItineraryVisualization;