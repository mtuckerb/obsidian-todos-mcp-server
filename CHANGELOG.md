# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2025-11-05

### Added
- **Query Parameter Support**: Enhanced `list_todos` tool to support filtering parameters
- Added support for `status`, `completed`, `path`, `tag`, and `exclude` filters
- Query parameters are now properly appended to API endpoints

### Technical
- Updated server version to 1.2.3
- Maintained compatibility with existing API endpoints
- No breaking changes to MCP tools interface

## [1.2.2] - 2025-11-05

### Performance
- Updated to work with obsidian-todos-api v1.1.17 performance optimizations
- Enhanced query parameter handling for improved filtering performance
- Optimized API calls to leverage server-side Dataview filtering improvements

### Technical
- Updated server version to 1.2.2
- Maintained compatibility with existing API endpoints
- No breaking changes to MCP tools interface

## [1.2.1] - 2025-11-05

### Added
- Initial MCP server implementation
- Full support for todo CRUD operations via Model Context Protocol
- Integration with obsidian-todos-api REST endpoints
- Support for due date queries and filtering

### Tools
- `list_todos`: List all todos with optional filtering
- `add_todo`: Add new todos to daily notes
- `update_todo`: Update existing todos (text, completion status)
- `get_todo_stats`: Retrieve todo statistics and aggregation
- `list_due_dates`: Query due dates with date range filtering
