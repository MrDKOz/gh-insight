# fetch_milestone_combined.ps1
# Usage: .\fetch_milestone_combined.ps1 "Milestone Name"

param(
    [Parameter(Mandatory=$true)]
    [string]$Milestone
)

Write-Host "Fetching issues for milestone: $Milestone" -ForegroundColor Cyan

# Get current repo info
$repoInfo = gh repo view --json nameWithOwner | ConvertFrom-Json
$repoName = $repoInfo.nameWithOwner
Write-Host "Repository: $repoName" -ForegroundColor Gray

# Get all issues from the milestone
$issuesJson = gh issue list --milestone $Milestone --state all --json number,title,createdAt,closedAt,url | ConvertFrom-Json

if ($issuesJson.Count -eq 0) {
    Write-Host "No issues found for milestone: $Milestone" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($issuesJson.Count) issues" -ForegroundColor Green
Write-Host ""

# Collect all items (issues and PRs)
$allItems = @()

foreach ($issue in $issuesJson) {
    Write-Host "Processing issue #$($issue.number)..." -ForegroundColor Gray
    
    # Add the issue itself
    $issueItem = @{
        type = "issue"
        number = $issue.number
        title = $issue.title
        createdAt = $issue.createdAt
        closedAt = $issue.closedAt
        url = $issue.url
        linkedPRs = @()
    }
    
    # Get linked PRs
    $issueData = gh issue view $issue.number --json closedByPullRequestsReferences | ConvertFrom-Json
    
    if ($issueData.closedByPullRequestsReferences -and $issueData.closedByPullRequestsReferences.Count -gt 0) {
        foreach ($prRef in $issueData.closedByPullRequestsReferences) {
            $prUrl = $prRef.url
            $prNum = $prRef.number
            
            Write-Host "  Found linked PR #$prNum" -ForegroundColor Green
            
            try {
                $prData = gh pr view $prUrl --json number,title,createdAt,mergedAt,closedAt,url | ConvertFrom-Json
                
                # Add PR as a separate item
                $prItem = @{
                    type = "pr"
                    number = $prData.number
                    title = $prData.title
                    createdAt = $prData.createdAt
                    mergedAt = $prData.mergedAt
                    closedAt = $prData.closedAt
                    url = $prData.url
                    linkedIssue = $issue.number
                }
                
                $allItems += $prItem
                $issueItem.linkedPRs += $prData.number
            } catch {
                Write-Host "    Warning: Failed to fetch PR #$prNum" -ForegroundColor Yellow
            }
        }
    }
    
    $allItems += $issueItem
}

Write-Host ""
Write-Host "Total items: $($allItems.Count)" -ForegroundColor Cyan
Write-Host ""

# Create output filenames
$safeMilestone = $Milestone -replace '[^a-zA-Z0-9_-]', '_'
$outputJson = "${safeMilestone}_combined.json"
$outputHtml = "${safeMilestone}_combined_timeline.html"

# Save JSON
$allItems | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputJson -Encoding UTF8
Write-Host "Data saved to: $outputJson" -ForegroundColor Green

# Read JSON
$dataRaw = Get-Content $outputJson -Raw

# Generate HTML
$htmlContent = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>$Milestone - Combined Timeline</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; padding: 30px; background: #f5f5f5; }
.container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
h1 { margin-bottom: 10px; color: #333; }
.subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
.timeline-container { position: relative; overflow-x: auto; padding: 20px 0; }
.date-labels { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #333; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 3px solid #333; margin-left: 310px; }
.date-label { background: #f0f0f0; padding: 4px 8px; border-radius: 3px; }
.item-row { display: flex; align-items: center; margin-bottom: 8px; position: relative; }
.item-label { flex-shrink: 0; font-size: 13px; padding-right: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: relative; display: flex; align-items: center; gap: 8px; }
.resize-handle { position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; background: transparent; z-index: 100; }
.resize-handle:hover { background: #4a90e2; }
.type-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px; text-transform: uppercase; flex-shrink: 0; }
.type-badge.issue { background: #0969da; color: white; }
.type-badge.pr { background: #8250df; color: white; }
.item-num { font-weight: bold; flex-shrink: 0; text-decoration: none; }
.item-num:hover { text-decoration: underline; }
.item-num.issue { color: #0969da; }
.item-num.pr { color: #8250df; }
.item-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timeline-track { flex: 1; position: relative; height: 30px; margin-left: 10px; }
.item-bar { position: absolute; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-start; padding: 0 8px; color: white; font-size: 10px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s; min-width: 60px; white-space: nowrap; }
.item-bar:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.3); z-index: 10; }
.item-bar.issue { background: linear-gradient(135deg, #0969da 0%, #0550ae 100%); }
.item-bar.pr { background: linear-gradient(135deg, #8250df 0%, #6639ba 100%); }
.item-bar.pr.not-merged { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); }
.item-bar.same-day { opacity: 0.9; min-width: 70px; }
.item-bar.short { min-width: 80px; }
.instructions { background: #e6f2ff; padding: 10px 15px; border-radius: 5px; margin-bottom: 20px; font-size: 13px; color: #0969da; }
.legend { display: flex; gap: 20px; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 8px; }
.legend-color { width: 20px; height: 20px; border-radius: 3px; }
.empty-message { text-align: center; padding: 60px 20px; color: #999; }
</style>
</head>
<body>
<div class="container">
    <h1>$Milestone - Combined Timeline</h1>
    <div class="subtitle" id="subtitle"></div>
    <div class="legend">
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #0969da 0%, #0550ae 100%);"></div>
            <span>Issues</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #8250df 0%, #6639ba 100%);"></div>
            <span>PRs (merged)</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);"></div>
            <span>PRs (closed without merge)</span>
        </div>
    </div>
    <div class="instructions">💡 Click issue/PR numbers to open in GitHub | Drag to resize column</div>
    <div class="timeline-container">
        <div class="date-labels" id="dateLabels"></div>
        <div id="timeline"></div>
    </div>
</div>
<script>
const items = $dataRaw;
if (!items || items.length === 0) {
    document.getElementById('subtitle').textContent = 'No data found';
    document.getElementById('timeline').innerHTML = '<div class="empty-message"><p>No items to display</p></div>';
} else {
    const issueCount = items.filter(i => i.type === 'issue').length;
    const prCount = items.filter(i => i.type === 'pr').length;
    document.getElementById('subtitle').textContent = issueCount + ' issue' + (issueCount !== 1 ? 's' : '') + ', ' + prCount + ' PR' + (prCount !== 1 ? 's' : '');
    
    let labelWidth = 350;
    
    function getDuration(created, completed) {
        if (!completed) return null;
        return Math.round((new Date(completed) - new Date(created)) / 86400000);
    }
    
    function formatDate(isoDate) {
        if (!isoDate) return 'N/A';
        return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    
    function updateDateLabelsMargin() {
        document.getElementById('dateLabels').style.marginLeft = (labelWidth + 10) + 'px';
    }
    
    const completedItems = items.filter(item => {
        if (item.type === 'issue') return item.closedAt;
        if (item.type === 'pr') return item.mergedAt || item.closedAt;
        return false;
    });
    
    if (completedItems.length === 0) {
        document.getElementById('timeline').innerHTML = '<div class="empty-message"><p>No completed items</p></div>';
    } else {
        const allDates = completedItems.flatMap(item => {
            const dates = [new Date(item.createdAt)];
            if (item.type === 'issue' && item.closedAt) {
                dates.push(new Date(item.closedAt));
            } else if (item.type === 'pr') {
                if (item.mergedAt) dates.push(new Date(item.mergedAt));
                else if (item.closedAt) dates.push(new Date(item.closedAt));
            }
            return dates;
        });
        
        const minDate = new Date(Math.min(...allDates));
        const maxDate = new Date(Math.max(...allDates));
        const totalDays = Math.ceil((maxDate - minDate) / 86400000);
        
        const dateLabels = document.getElementById('dateLabels');
        for (let i = 0; i <= 8; i++) {
            const label = document.createElement('div');
            label.className = 'date-label';
            label.textContent = formatDate(new Date(minDate.getTime() + (totalDays / 8 * i) * 86400000));
            dateLabels.appendChild(label);
        }
        
        const sortedItems = [...completedItems].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const timeline = document.getElementById('timeline');
        sortedItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'item-row';
            
            const label = document.createElement('div');
            label.className = 'item-label';
            label.style.width = labelWidth + 'px';
            
            const badge = document.createElement('span');
            badge.className = 'type-badge ' + item.type;
            badge.textContent = item.type.toUpperCase();
            
            const numLink = document.createElement('a');
            numLink.className = 'item-num ' + item.type;
            numLink.href = item.url;
            numLink.target = '_blank';
            numLink.textContent = '#' + item.number;
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'item-title';
            titleSpan.textContent = item.title;
            
            label.appendChild(badge);
            label.appendChild(numLink);
            label.appendChild(titleSpan);
            label.title = (item.type === 'pr' ? 'PR' : 'Issue') + ' #' + item.number + ': ' + item.title + (item.linkedIssue ? ' (closes #' + item.linkedIssue + ')' : '');
            
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startX = e.clientX, startWidth = labelWidth;
                function onMove(e) {
                    labelWidth = Math.max(200, startWidth + (e.clientX - startX));
                    document.querySelectorAll('.item-label').forEach(el => el.style.width = labelWidth + 'px');
                    updateDateLabelsMargin();
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            label.appendChild(handle);
            
            const track = document.createElement('div');
            track.className = 'timeline-track';
            
            const created = new Date(item.createdAt);
            let completed, duration;
            
            if (item.type === 'issue') {
                completed = new Date(item.closedAt);
                duration = getDuration(item.createdAt, item.closedAt);
            } else {
                completed = item.mergedAt ? new Date(item.mergedAt) : new Date(item.closedAt);
                duration = getDuration(item.createdAt, item.mergedAt || item.closedAt);
            }
            
            const startOffset = ((created - minDate) / 86400000) / totalDays * 100;
            const durationWidth = ((completed - created) / 86400000) / totalDays * 100;
            
            const bar = document.createElement('div');
            let barClass = 'item-bar ' + item.type;
            if (item.type === 'pr' && !item.mergedAt && item.closedAt) barClass += ' not-merged';
            if (duration === 0) barClass += ' same-day';
            else if (duration <= 2) barClass += ' short';
            
            bar.className = barClass;
            bar.style.left = startOffset + '%';
            bar.style.width = durationWidth + '%';
            
            const durationText = duration === 0 ? 'Same day' : duration === 1 ? '1 day' : duration + ' days';
            
            if (duration <= 2) {
                bar.textContent = durationText;
            } else {
                const completedDate = item.type === 'pr' ? (item.mergedAt || item.closedAt) : item.closedAt;
                bar.textContent = formatDate(item.createdAt) + ' → ' + formatDate(completedDate) + ' (' + durationText + ')';
            }
            
            const status = item.type === 'pr' ? (item.mergedAt ? 'Merged' : 'Closed') : 'Closed';
            const completedDate = item.type === 'pr' ? (item.mergedAt || item.closedAt) : item.closedAt;
            bar.title = (item.type === 'pr' ? 'PR' : 'Issue') + ' #' + item.number + ': ' + item.title + 
                        (item.linkedIssue ? '\nCloses #' + item.linkedIssue : '') +
                        '\nOpened: ' + formatDate(item.createdAt) + 
                        '\n' + status + ': ' + formatDate(completedDate) + 
                        '\nDuration: ' + durationText;
            
            track.appendChild(bar);
            row.appendChild(label);
            row.appendChild(track);
            timeline.appendChild(row);
        });
    }
}
</script>
</body>
</html>
"@

$htmlContent | Out-File -FilePath $outputHtml -Encoding UTF8
Write-Host "HTML timeline saved to: $outputHtml" -ForegroundColor Green
Write-Host ""
Write-Host "Done! Open $outputHtml in your browser." -ForegroundColor Cyan
