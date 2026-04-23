/**
 * OpenAPI / Swagger 配置
 * 访问文档：GET /api/docs
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AlpineLink API',
      version: '1.0.0',
      description:
        'AlpineLink 登山社区平台后端 API 文档。包含用户认证、山峰信息、向导、俱乐部、轨迹、帖子、订单等全部接口。',
      contact: {
        name: 'AlpineLink',
      },
    },
    servers: [
      {
        url: process.env.API_BASE || 'http://localhost:3000',
        description: '当前服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '使用 /api/auth/login 获取 JWT token，然后在请求头中携带：Authorization: Bearer <token>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: '错误信息' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['user', 'guide', 'club_admin', 'admin'] },
            avatar: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Peak: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            altitude: { type: 'number' },
            location: { type: 'string' },
            difficulty: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
        Guide: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            name: { type: 'string' },
            bio: { type: 'string', nullable: true },
            rating: { type: 'number' },
            cert_level: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          },
        },
        Club: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            member_count: { type: 'integer' },
            rating: { type: 'number' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            title: { type: 'string' },
            content: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            likes: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Track: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            name: { type: 'string' },
            distance: { type: 'number', description: '单位：米' },
            elevation_gain: { type: 'number', description: '单位：米' },
            duration: { type: 'integer', description: '单位：秒' },
            gpx_url: { type: 'string', nullable: true },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: '认证', description: '用户注册、登录、账号管理' },
      { name: '山峰', description: '山峰信息查询' },
      { name: '向导', description: '向导列表、详情、申请、服务' },
      { name: '俱乐部', description: '俱乐部列表、详情、成员管理、活动' },
      { name: '帖子', description: '社区帖子、点赞、收藏' },
      { name: '轨迹', description: '轨迹记录上传与查询' },
      { name: '搜索', description: '全局搜索' },
      { name: '装备', description: '装备库' },
      { name: '徽章', description: '用户成就徽章' },
      { name: '消息', description: '站内消息' },
      { name: '通知', description: '通知中心' },
      { name: '排行榜', description: '登山排行榜' },
      { name: '管理员', description: '后台管理接口（需 admin 角色）' },
      { name: '订单', description: '活动报名订单、向导服务订单' },
      { name: '远征', description: '线下远征计划' },
      { name: '健康', description: '服务健康检查' },
    ],
  },
  apis: [
    `${__dirname}/routes/*.js`,
    `${__dirname}/app.js`,
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
