/**
 * Permission Graph Visualizer
 * Generates interactive visualizations of the RBAC permission hierarchy
 * Uses vis-network for interactive graph rendering
 */

import { PermissionService } from '../core/permission.service';

export interface GraphNode {
  id: string;
  label: string;
  color?: {
    background: string;
    border: string;
  };
  font?: {
    size: number;
  };
  group?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface GraphVisualization {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
  };
}

export class PermissionVisualizer {
  private permissionService: PermissionService;

  constructor(permissionService: PermissionService) {
    this.permissionService = permissionService;
  }

  /**
   * Generate visualization data for vis-network
   */
  generateGraphData(): GraphVisualization {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Get all permissions that should be visualized
    const allPermissions = this.getPermissionsForVisualization();

    // Add nodes
    allPermissions.forEach(permissionId => {
      if (!nodeIds.has(permissionId)) {
        nodes.push({
          id: permissionId,
          label: permissionId,
          color: this.getNodeColor(permissionId),
          font: { size: 11 },
          group: this.getPermissionType(permissionId)
        });
        nodeIds.add(permissionId);
      }
    });

    // Add edges based on what each permission grants
    allPermissions.forEach(permissionId => {
      const grants = this.permissionService.whatDoesPermissionGrant(permissionId);
      grants.forEach(grantedPermission => {
        if (nodeIds.has(grantedPermission) && permissionId !== grantedPermission) {
          edges.push({
            from: permissionId,
            to: grantedPermission
          });
        }
      });
    });

    return {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length
      }
    };
  }

  /**
   * Generate HTML visualization page for module hierarchy
   */
  generateModuleHierarchyVisualization(): string {
    const graphData = this.generateModuleHierarchyData();
    const rbacStructure = this.getRBACStructure();
    const moduleCount = Object.keys(rbacStructure).length;
    const totalSubmodules = Object.values(rbacStructure).reduce((sum, arr) => sum + arr.length, 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>@prashantbasnet/rbac - Module Hierarchy</title>
        <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: #f5f5f5;
            color: #333;
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }

          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
          }

          .header p {
            font-size: 14px;
            opacity: 0.9;
          }

          .controls-panel {
            background: white;
            padding: 20px;
            border-bottom: 1px solid #ddd;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .control-group {
            display: flex;
            gap: 10px;
            align-items: center;
          }

          .control-group label {
            font-weight: 600;
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .control-group button,
          .control-group input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            color: #333;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
          }

          .control-group button:hover {
            background: #f0f0f0;
            border-color: #999;
          }

          .control-group input {
            width: 250px;
          }

          .stats-bar {
            background: white;
            padding: 15px 20px;
            border-bottom: 1px solid #ddd;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            font-size: 13px;
          }

          .stat-item {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .stat-label {
            color: #666;
            font-weight: 500;
          }

          .stat-value {
            color: #667eea;
            font-weight: 700;
            font-size: 16px;
          }

          #graph {
            width: 100%;
            height: calc(100vh - 280px);
            background: white;
            position: relative;
          }

          .legend {
            background: white;
            padding: 15px 20px;
            border-top: 1px solid #ddd;
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
            font-size: 12px;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 2px solid;
          }

          .legend-module { background: #4CAF50; border-color: #388E3C; }
          .legend-submodule { background: #F44336; border-color: #C62828; }

          #nodeDetails {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            padding: 20px;
            max-width: 350px;
            z-index: 1000;
            max-height: 80vh;
            overflow-y: auto;
            display: none;
          }

          #nodeDetails h3 {
            margin: 0 0 15px 0;
            color: #667eea;
            font-size: 16px;
          }

          #nodeDetails .item-list {
            background: #f5f5f5;
            border-radius: 4px;
            padding: 10px;
            max-height: 300px;
            overflow-y: auto;
            margin: 10px 0;
          }

          #nodeDetails .item {
            padding: 6px 0;
            font-size: 12px;
            color: #666;
            border-bottom: 1px solid #eee;
          }

          #nodeDetails .item:last-child {
            border-bottom: none;
          }

          #nodeDetails button {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
            transition: background 0.2s;
          }

          #nodeDetails button:hover {
            background: #764ba2;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 RBAC Module Hierarchy</h1>
          <p>Visual representation of modules (green) and submodules (red)</p>
        </div>

        <div class="controls-panel">
          <div class="control-group" style="margin-left: auto;">
            <button onclick="resetZoom()">Reset View</button>
            <button onclick="togglePhysics()" id="physicsBtn">Toggle Physics</button>
            <button onclick="exportGraph()">Export</button>
          </div>
        </div>

        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">Modules:</span>
            <span class="stat-value">${moduleCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Submodules:</span>
            <span class="stat-value">${totalSubmodules}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Nodes:</span>
            <span class="stat-value">${graphData.stats.totalNodes}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Relationships:</span>
            <span class="stat-value">${graphData.stats.totalEdges}</span>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-color legend-module"></div>
            <span>Module (Main Category)</span>
          </div>
          <div class="legend-item">
            <div class="legend-color legend-submodule"></div>
            <span>Submodule (Resource)</span>
          </div>
        </div>

        <div id="graph"></div>
        <div id="nodeDetails"></div>

        <script>
          const graphData = ${JSON.stringify(graphData)};
          let physicsEnabled = true;
          let network = null;

          function initializeNetwork() {
            const container = document.getElementById('graph');
            const options = {
              nodes: {
                shape: 'box',
                font: { size: 12, color: '#fff', bold: { size: 14 } },
                margin: 12,
                borderWidth: 2.5,
                shadow: { enabled: true, color: 'rgba(0,0,0,0.25)', size: 12, x: 5, y: 5 }
              },
              edges: {
                arrows: { to: { enabled: true, scaleFactor: 0.8 } },
                color: { color: '#999', opacity: 0.6 },
                smooth: { enabled: true, type: 'continuous' },
                font: { size: 10, align: 'middle' },
                width: 2
              },
              physics: {
                enabled: true,
                stabilization: { iterations: 200 },
                barnesHut: {
                  gravitationalConstant: -4000,
                  centralGravity: 0.5,
                  springLength: 200,
                  springConstant: 0.05,
                  damping: 0.1
                }
              },
              layout: {
                hierarchical: {
                  enabled: true,
                  levelSeparation: 200,
                  nodeSpacing: 300,
                  treeSpacing: 250,
                  blockShifting: true,
                  edgeMinimization: true,
                  direction: 'UD',
                  sortMethod: 'directed'
                }
              }
            };

            network = new vis.Network(container, graphData, options);

            network.on('click', function(params) {
              if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                showNodeDetails(nodeId);
              }
            });

            // Auto-fit and stabilize
            setTimeout(() => {
              network.fit();
            }, 500);
          }

          function showNodeDetails(nodeId) {
            const details = document.getElementById('nodeDetails');
            const isModule = nodeId.startsWith('module:');
            const isSubmodule = nodeId.startsWith('submodule:');

            if (isModule) {
              const moduleName = nodeId.replace('module:', '');
              const submodules = graphData.nodes
                .filter(n => n.id.startsWith('submodule:') && n.id.includes(moduleName + '.'))
                .map(n => n.label);

              details.innerHTML = \`
                <h3>📦 \${moduleName.toUpperCase()}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Module with \${submodules.length} submodules</p>
                <div style="font-weight: 600; color: #667eea; font-size: 12px; margin-bottom: 5px;">Submodules:</div>
                <div class="item-list">
                  \${submodules.map(s => \`<div class="item">• \${s}</div>\`).join('')}
                </div>
                <button onclick="closeDetails()">Close</button>
              \`;
            } else if (isSubmodule) {
              const submoduleName = nodeId.replace('submodule:', '');
              const [module, resource] = submoduleName.split('.');

              details.innerHTML = \`
                <h3>📄 \${resource}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Submodule</p>
                <div style="font-weight: 600; color: #667eea; font-size: 12px; margin-bottom: 5px;">Module:</div>
                <div class="item-list">
                  <div class="item">• \${module}</div>
                </div>
                <button onclick="closeDetails()">Close</button>
              \`;
            }

            details.style.display = 'block';
          }

          function closeDetails() {
            document.getElementById('nodeDetails').style.display = 'none';
          }

          function togglePhysics() {
            physicsEnabled = !physicsEnabled;
            if (network) {
              network.setOptions({ physics: { enabled: physicsEnabled } });
            }
            document.getElementById('physicsBtn').textContent = physicsEnabled ? 'Disable Physics' : 'Enable Physics';
          }

          function resetZoom() {
            if (network) {
              network.fit();
            }
          }

          function exportGraph() {
            const data = {
              nodes: graphData.nodes,
              edges: graphData.edges,
              stats: graphData.stats,
              exportedAt: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'rbac-module-hierarchy-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }

          // Initialize on load
          initializeNetwork();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML visualization page
   */
  generateHTMLVisualization(): string {
    const graphData = this.generateGraphData();
    const stats = this.permissionService.getStats();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>@prashantbasnet/rbac - Permission Graph Visualizer</title>
        <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: #f5f5f5;
            color: #333;
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }

          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
          }

          .header p {
            font-size: 14px;
            opacity: 0.9;
          }

          .controls-panel {
            background: white;
            padding: 20px;
            border-bottom: 1px solid #ddd;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .control-group {
            display: flex;
            gap: 10px;
            align-items: center;
          }

          .control-group label {
            font-weight: 600;
            font-size: 13px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .control-group button,
          .control-group select,
          .control-group input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            color: #333;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
          }

          .control-group button:hover {
            background: #f0f0f0;
            border-color: #999;
          }

          .control-group button.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
          }

          .control-group input {
            width: 250px;
          }

          .stats-bar {
            background: white;
            padding: 15px 20px;
            border-bottom: 1px solid #ddd;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            font-size: 13px;
          }

          .stat-item {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .stat-label {
            color: #666;
            font-weight: 500;
          }

          .stat-value {
            color: #667eea;
            font-weight: 700;
            font-size: 16px;
          }

          #graph {
            width: 100%;
            height: calc(100vh - 280px);
            background: white;
            position: relative;
          }

          .legend {
            background: white;
            padding: 15px 20px;
            border-top: 1px solid #ddd;
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
            font-size: 12px;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 2px solid;
          }

          .legend-wildcard { background: #FF5722; border-color: #D84315; }
          .legend-module { background: #4CAF50; border-color: #388E3C; }
          .legend-resource { background: #2196F3; border-color: #1976D2; }

          #tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 12px;
            display: none;
            pointer-events: none;
            z-index: 1001;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            line-height: 1.4;
          }

          #nodeDetails {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            padding: 20px;
            max-width: 350px;
            z-index: 1000;
            max-height: 80vh;
            overflow-y: auto;
          }

          #nodeDetails h3 {
            margin: 0 0 15px 0;
            color: #667eea;
            font-size: 16px;
          }

          #nodeDetails .grant-list {
            background: #f5f5f5;
            border-radius: 4px;
            padding: 10px;
            max-height: 300px;
            overflow-y: auto;
            margin: 10px 0;
          }

          #nodeDetails .grant-item {
            padding: 6px 0;
            font-size: 12px;
            color: #666;
            border-bottom: 1px solid #eee;
          }

          #nodeDetails .grant-item:last-child {
            border-bottom: none;
          }

          #nodeDetails button {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
            transition: background 0.2s;
          }

          #nodeDetails button:hover {
            background: #764ba2;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 RBAC Permission Graph Visualizer</h1>
          <p>Interactive visualization of permission hierarchy and relationships</p>
        </div>

        <div class="controls-panel">
          <div class="control-group">
            <label>View:</label>
            <button onclick="showAll()" id="showAllBtn" class="active">Show All</button>
            <button onclick="showWildcards()" id="wildcardsBtn">Wildcards Only</button>
          </div>

          <div class="control-group">
            <label>Color By:</label>
            <select id="colorScheme" onchange="changeColorScheme()">
              <option value="type">Permission Type</option>
              <option value="action">Action</option>
            </select>
          </div>

          <div class="control-group">
            <label>Search:</label>
            <input type="text" id="searchInput" placeholder="Search permissions..." onkeyup="handleSearch(event)">
            <button onclick="clearSearch()">Clear</button>
          </div>

          <div class="control-group" style="margin-left: auto;">
            <button onclick="togglePhysics()" id="physicsBtn">Toggle Physics</button>
            <button onclick="resetZoom()">Reset View</button>
            <button onclick="exportGraph()">Export</button>
          </div>
        </div>

        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">Total Permissions:</span>
            <span class="stat-value">${stats.totalPermissions}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Grant Relationships:</span>
            <span class="stat-value">${stats.grantRelationships}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Modules:</span>
            <span class="stat-value">${stats.modules}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Visible Nodes:</span>
            <span class="stat-value" id="visibleNodes">${graphData.stats.totalNodes}</span>
          </div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <div class="legend-color legend-wildcard"></div>
            <span>Wildcard (*:action)</span>
          </div>
          <div class="legend-item">
            <div class="legend-color legend-module"></div>
            <span>Module Level</span>
          </div>
          <div class="legend-item">
            <div class="legend-color legend-resource"></div>
            <span>Resource Level</span>
          </div>
        </div>

        <div id="graph"></div>
        <div id="tooltip"></div>
        <div id="nodeDetails"></div>

        <script>
          const fullGraphData = ${JSON.stringify(graphData)};
          let currentColorScheme = 'type';
          let physicsEnabled = true;
          let network = null;

          const COLOR_SCHEMES = {
            type: {
              wildcard: { background: '#FF5722', border: '#D84315' },
              module: { background: '#4CAF50', border: '#388E3C' },
              resource: { background: '#2196F3', border: '#1976D2' }
            },
            action: {
              delete: { background: '#F44336', border: '#C62828' },
              create: { background: '#4CAF50', border: '#388E3C' },
              update: { background: '#FF9800', border: '#F57C00' },
              read: { background: '#2196F3', border: '#1976D2' }
            }
          };

          function getNodeColorByScheme(permissionId, scheme) {
            if (scheme === 'action') {
              const action = permissionId.split(':')[1];
              return COLOR_SCHEMES.action[action] || COLOR_SCHEMES.action.read;
            } else {
              if (permissionId.startsWith('*:')) {
                return COLOR_SCHEMES.type.wildcard;
              } else if (permissionId.includes('.')) {
                return COLOR_SCHEMES.type.resource;
              } else {
                return COLOR_SCHEMES.type.module;
              }
            }
          }

          function initializeNetwork() {
            const container = document.getElementById('graph');
            const options = {
              nodes: {
                shape: 'box',
                font: { size: 11, color: '#333' },
                margin: 10,
                borderWidth: 2,
                shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 10, x: 5, y: 5 }
              },
              edges: {
                arrows: { to: { enabled: true, scaleFactor: 0.5 } },
                color: { color: '#999', opacity: 0.6 },
                smooth: { enabled: true, type: 'continuous' }
              },
              physics: {
                enabled: true,
                stabilization: { iterations: 200 },
                barnesHut: {
                  gravitationalConstant: -8000,
                  centralGravity: 0.3,
                  springLength: 150,
                  springConstant: 0.04,
                  damping: 0.09
                }
              },
              layout: {
                hierarchical: {
                  enabled: true,
                  levelSeparation: 150,
                  nodeSpacing: 250,
                  treeSpacing: 200,
                  blockShifting: true,
                  edgeMinimization: true,
                  direction: 'UD',
                  sortMethod: 'directed'
                }
              }
            };

            const data = applyColorScheme(fullGraphData, currentColorScheme);
            network = new vis.Network(container, data, options);

            network.on('click', function(params) {
              if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                showNodeDetails(nodeId);
              }
            });

            network.on('hoverNode', function(params) {
              const nodeId = params.node;
              showTooltip(nodeId, params.pointer.DOM);
            });

            network.on('blurNode', function() {
              hideTooltip();
            });
          }

          function applyColorScheme(graphData, scheme) {
            const coloredNodes = graphData.nodes.map(node => ({
              ...node,
              color: getNodeColorByScheme(node.id, scheme)
            }));

            return {
              nodes: coloredNodes,
              edges: graphData.edges
            };
          }

          function showAll() {
            setActiveButton('showAllBtn');
            const data = applyColorScheme(fullGraphData, currentColorScheme);
            if (network) {
              network.setData(data);
            }
            document.getElementById('visibleNodes').textContent = fullGraphData.stats.totalNodes;
          }

          function showWildcards() {
            setActiveButton('wildcardsBtn');
            const filtered = {
              nodes: fullGraphData.nodes.filter(n => n.id.startsWith('*:')),
              edges: fullGraphData.edges.filter(e =>
                e.from.startsWith('*:') || e.to.startsWith('*:')
              ),
              stats: { totalNodes: 0, totalEdges: 0 }
            };
            const data = applyColorScheme(filtered, currentColorScheme);
            if (network) {
              network.setData(data);
            }
            document.getElementById('visibleNodes').textContent = filtered.nodes.length;
          }

          function changeColorScheme() {
            const select = document.getElementById('colorScheme');
            currentColorScheme = select.value;
            const data = applyColorScheme(fullGraphData, currentColorScheme);
            if (network) {
              network.setData(data);
            }
          }

          function showNodeDetails(nodeId) {
            const details = document.getElementById('nodeDetails');
            // This would normally fetch grant information from the server
            details.innerHTML = \`
              <h3>\${nodeId}</h3>
              <p style="font-size: 12px; color: #666;">Click to view grant details</p>
              <button onclick="closeDetails()">Close</button>
            \`;
          }

          function closeDetails() {
            document.getElementById('nodeDetails').innerHTML = '';
          }

          function showTooltip(nodeId, position) {
            const tooltip = document.getElementById('tooltip');
            const type = nodeId.startsWith('*:') ? 'Wildcard' : nodeId.includes('.') ? 'Resource' : 'Module';
            tooltip.innerHTML = \`<strong>\${nodeId}</strong><br><em style="color: #aaa;">\${type} Permission</em>\`;
            tooltip.style.left = (position.x + 10) + 'px';
            tooltip.style.top = (position.y - 10) + 'px';
            tooltip.style.display = 'block';
          }

          function hideTooltip() {
            document.getElementById('tooltip').style.display = 'none';
          }

          function handleSearch(event) {
            if (event.key === 'Enter') {
              filterBySearch(event.target.value.toLowerCase());
            }
          }

          function filterBySearch(query) {
            if (!query) {
              showAll();
              return;
            }

            const filtered = {
              nodes: fullGraphData.nodes.filter(n => n.id.toLowerCase().includes(query)),
              edges: fullGraphData.edges.filter(e =>
                fullGraphData.nodes.some(n => n.id === e.from && n.id.toLowerCase().includes(query)) ||
                fullGraphData.nodes.some(n => n.id === e.to && n.id.toLowerCase().includes(query))
              ),
              stats: { totalNodes: 0, totalEdges: 0 }
            };

            const data = applyColorScheme(filtered, currentColorScheme);
            if (network) {
              network.setData(data);
            }
            document.getElementById('visibleNodes').textContent = filtered.nodes.length;
          }

          function clearSearch() {
            document.getElementById('searchInput').value = '';
            showAll();
          }

          function setActiveButton(buttonId) {
            document.querySelectorAll('.control-group button').forEach(btn => btn.classList.remove('active'));
            document.getElementById(buttonId).classList.add('active');
          }

          function togglePhysics() {
            physicsEnabled = !physicsEnabled;
            if (network) {
              network.setOptions({ physics: { enabled: physicsEnabled } });
            }
            document.getElementById('physicsBtn').textContent = physicsEnabled ? 'Disable Physics' : 'Enable Physics';
          }

          function resetZoom() {
            if (network) {
              network.fit();
            }
          }

          function exportGraph() {
            const data = {
              nodes: fullGraphData.nodes,
              edges: fullGraphData.edges,
              stats: fullGraphData.stats,
              exportedAt: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'rbac-permission-graph-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }

          // Initialize on load
          initializeNetwork();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Get the RBAC configuration for module/submodule structure visualization
   */
  private getRBACStructure(): Record<string, string[]> {
    return {
      // User Management
      users: ['profile', 'settings', 'roles'],

      // Content Management
      posts: ['draft', 'published', 'comments'],
      pages: ['content', 'metadata', 'versions'],

      // Community
      comments: ['content', 'moderation'],
      tags: ['management'],

      // Administration
      admin: ['users', 'content', 'settings', 'logs'],

      // Analytics
      analytics: ['dashboard', 'reports', 'exports']
    };
  }

  /**
   * Generate visualization data with hierarchical module structure
   */
  generateModuleHierarchyData(): GraphVisualization {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const rbacStructure = this.getRBACStructure();

    // Add module nodes (green) and submodule nodes (red)
    Object.entries(rbacStructure).forEach(([module, submodules]) => {
      // Add module node in GREEN
      nodes.push({
        id: `module:${module}`,
        label: module.toUpperCase(),
        color: {
          background: '#4CAF50',  // Green
          border: '#388E3C'
        },
        font: { size: 13 },
        group: 'module'
      });

      // Add submodule nodes in RED
      submodules.forEach(submodule => {
        const submoduleId = `${module}.${submodule}`;
        nodes.push({
          id: `submodule:${submoduleId}`,
          label: submodule,
          color: {
            background: '#F44336',  // Red
            border: '#C62828'
          },
          font: { size: 11 },
          group: 'submodule'
        });

        // Add edge from module to submodule
        edges.push({
          from: `module:${module}`,
          to: `submodule:${submoduleId}`,
          label: 'contains'
        });
      });
    });

    return {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length
      }
    };
  }

  /**
   * Get permissions to visualize (sample key permissions)
   */
  private getPermissionsForVisualization(): string[] {
    // For now, return a sample. In production, you'd fetch from the service
    return [
      '*:delete', '*:update', '*:create', '*:read'
    ];
  }

  /**
   * Get color for a permission node
   */
  private getNodeColor(permissionId: string): { background: string; border: string } {
    if (permissionId.startsWith('*:')) {
      return { background: '#FF5722', border: '#D84315' };
    } else if (permissionId.includes('.')) {
      return { background: '#2196F3', border: '#1976D2' };
    } else {
      return { background: '#4CAF50', border: '#388E3C' };
    }
  }

  /**
   * Get permission type
   */
  private getPermissionType(permissionId: string): string {
    if (permissionId.startsWith('*:')) {
      return 'wildcard';
    } else if (permissionId.includes('.')) {
      return 'resource';
    } else {
      return 'module';
    }
  }
}
