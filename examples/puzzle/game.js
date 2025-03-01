/*
    LittleJS Puzzle Example
    - A match 3 style puzzle game to get you started
    - Uses a higher resolution texture
*/

'use strict';

glOverlay = !isChrome; // fix slow rendering when not chrome
pixelated = 0; // do not use pixelated rendering

const fallTime = .2;
const cameraOffset = vec2(0,-.5);
const backgroundColor = new Color(.3,.3,.3);

// zzfx sounds
const sound_goodMove = [.4,.2,250,.04,,.04,,,1,,,,,3];
const sound_badMove =  [,,700,,,.07,,,,3.7,,,,3,,,.1];
const sound_fall =     [.2,,1900,,,.01,,1.4,,91,,,,,,,,,,.7];

let level, levelSize, levelFall, fallTimer, dragStartPos, comboCount, score, bestScore;

///////////////////////////////////////////////////////////////////////////////
// tiles
const tileColors = 
[
    new Color(1,0,0),
    new Color(1,1,1),
    new Color(1,1,0),
    new Color(0,1,0),
    new Color(0,.6,1),
    new Color(.6,0,1),
    new Color(.5,.5,.5),
];
const tileTypeCount = tileColors.length;

const getTile = (pos)       => level[pos.x + pos.y * levelSize.x];
const setTile = (pos, data) => level[pos.x + pos.y * levelSize.x] = data;

///////////////////////////////////////////////////////////////////////////////
function gameInit()
{
    fixedWidth = 1920, fixedHeight = 1080; // 1080p
    mainCanvas.style.background = backgroundColor.rgba();

    // randomize level
    level = [];
    levelSize = vec2(12,6);
    const pos = vec2();
    for (pos.x = levelSize.x; pos.x--;)
    for (pos.y = levelSize.y; pos.y--;)
        setTile(pos, randInt(tileTypeCount));

    cameraPos = levelSize.scale(.5).add(cameraOffset);
    cameraScale = 900/levelSize.y;
    gravity = -.005;
    fallTimer = new Timer;
    comboCount = score = 0;

    // load high score
    bestScore = localStorage['puzzleBestScore'] || 0;
}

///////////////////////////////////////////////////////////////////////////////
function gameUpdate()
{
    if (fallTimer.isSet())
    {
        // update falling tiles
        if (fallTimer.elapsed())
        {
            // add more blocks in the top
            for(let x = 0; x < levelSize.x; ++x)
                setTile(vec2(x,levelSize.y),randInt(tileTypeCount));
        }
        
        // allow blocks to fall
        if (!fallTimer.active())
        {
            // check if there is more to fall
            levelFall = [];
            let keepFalling = 0;
            const pos = vec2();
            for (pos.x = levelSize.x; pos.x--;)
            for (pos.y = 0; pos.y<levelSize.y; pos.y++)
            {
                const data = getTile(pos);
                const abovePos = pos.add(vec2(0,1));
                const aboveData = getTile(abovePos);
                if (data == -1 && aboveData >= 0)
                {
                    setTile(pos, aboveData);
                    setTile(abovePos, -1);
                    levelFall[pos.x+pos.y*levelSize.x] = keepFalling = 1;
                }
            }

            if (keepFalling)
            {
                const p = percent(comboCount, 0, 9);
                fallTimer.set(fallTime*p);
                playSound(sound_fall);
            }
            else
                fallTimer.unset();
        }
    }
    else
    {
        // try to clear matches
        clearMatches();
        if (!fallTimer.isSet())
        {
            // mouse/touch control
            const mouseTilePos = mousePos.floor();
            if (!mousePos.arrayCheck(levelSize))
            {
                // cancel drag if mouse is not in the level bounds
                dragStartPos = 0;
            }
            else if (mouseWasPressed(0) && !dragStartPos)
            {
                // start drag
                dragStartPos = mouseTilePos.copy();
            }
            else if (mouseIsDown(0) && dragStartPos)
            {
                // if dragging to a neighbor tile
                if ((abs(dragStartPos.x - mouseTilePos.x) == 1) ^ (abs(dragStartPos.y - mouseTilePos.y) == 1))
                {
                    const startTile = getTile(dragStartPos);
                    const endTile =   getTile(mouseTilePos);
                    if (startTile >= 0 && endTile >= 0)
                    {
                        // swap tiles
                        setTile(mouseTilePos, startTile);
                        setTile(dragStartPos, endTile);

                        // try to clear matches
                        clearMatches();

                        // undo if no matches
                        if (!fallTimer.isSet())
                        {
                            playSound(sound_badMove);
                            setTile(mouseTilePos, endTile);
                            setTile(dragStartPos, startTile);
                        }
                        else
                            playSound(sound_goodMove);
                        dragStartPos = 0;
                    }
                }
            }
            else
                dragStartPos = 0;
        }
    }

    if (score > bestScore)
    {
        // update high score
        bestScore = score;
        localStorage['puzzleBestScore'] = bestScore;
    }
}

///////////////////////////////////////////////////////////////////////////////
function gameUpdatePost()
{

}

///////////////////////////////////////////////////////////////////////////////
function gameRender()
{
    // draw a black square for the background
    drawRect(cameraPos.subtract(cameraOffset), levelSize, new Color(0,0,0));

    // draw the blocks
    const pos = vec2();
    const tileSize = .95;
    const outlineColor = new Color(0,0,0);
    for (pos.x = levelSize.x; pos.x--;)
    for (pos.y = levelSize.y; pos.y--;)
    {
        const data = getTile(pos);
        if (data == -1)
            continue;

        const drawPos = pos.add(vec2(.5));
        if (dragStartPos && pos.x == dragStartPos.x && pos.y == dragStartPos.y)
            drawRect(drawPos, vec2(1.05));

        if (fallTimer.active() && levelFall[pos.x + pos.y*levelSize.x])
            drawPos.y += 1-fallTimer.getPercent();
        drawRect(drawPos, vec2(tileSize), tileColors[data]);
        drawTile(drawPos, vec2(tileSize/2), data, vec2(64), outlineColor);
    }

    // draw a grey square at top to cover up incomming tiles
    drawRect(cameraPos.subtract(cameraOffset).add(vec2(0,levelSize.y)), levelSize, backgroundColor);
}

///////////////////////////////////////////////////////////////////////////////
function gameRenderPost()
{
    // draw text on top of everything
    drawText('Score: ' + score, cameraPos.add(vec2(-3,-3)), .9, new Color, .1);
    drawText('Best: ' + bestScore, cameraPos.add(vec2(3,-3)), .9, new Color, .1);
}

///////////////////////////////////////////////////////////////////////////////
// Startup LittleJS Engine
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, 'tiles.png');

///////////////////////////////////////////////////////////////////////////////
// find and remove all runs of 3 or higher
function clearMatches()
{
    // horizontal match check
    const removeTiles = [], pos = vec2();
    for (pos.y = levelSize.y; pos.y--;)
    {
        let runCount, runData;
        for (pos.x = levelSize.x; pos.x--;)
        {
            const data = getTile(pos);
            if (data >= 0 && data == runData)
            {
                ++runCount;
                if (runCount == 3)
                    for (let j=runCount; j--;)
                        removeTiles[pos.x + j + pos.y * levelSize.x] = 1;
                else if (runCount > 3)
                    removeTiles[pos.x + pos.y * levelSize.x] = 1;
            }
            else
            {
                runData = data;
                runCount = 1;
            }
        }
    }

    // vertical match check
    for (pos.x = levelSize.x; pos.x--;)
    {
        let runCount, runData;
        for (pos.y = levelSize.y; pos.y--;)
        {
            const data = getTile(pos);
            if (data >= 0 && data == runData)
            {
                ++runCount;
                if (runCount == 3)
                    for (let j=runCount; j--;)
                        removeTiles[pos.x + (pos.y + j) * levelSize.x] = 1;
                else if (runCount > 3)
                    removeTiles[pos.x + pos.y * levelSize.x] = 1;
            }
            else
            {
                runData = data;
                runCount = 1;
            }
        }
    }

    // remove tiles all at once like this incase an L or T shape is formed
    let removedCount = 0;
    for (pos.x = levelSize.x; pos.x--;)
    for (pos.y = levelSize.y; pos.y--;)
    {
        if (removeTiles[pos.x + pos.y * levelSize.x])
        {
            // remove tile
            ++removedCount;
            const data = getTile(pos);
            setTile(pos, -1);

            // spawn particles
            const color1 = tileColors[data];
            const color2 = color1.lerp(new Color, .5);
            new ParticleEmitter(
                pos.add(vec2(.5)), 1, .1, 100, PI,   // pos, emitSize, emitTime, emitRate, emiteCone
                undefined, undefined,                // tileIndex, tileSize
                color1, color2,                      // colorStartA, colorStartB
                color1.scale(1,0), color2.scale(1,0),// colorEndA, colorEndB
                .5, .3, .3, .05, .05, // particleTime, sizeStart, sizeEnd, particleSpeed, particleAngleSpeed
                .99, 1, 1, PI, .05,   // damping, angleDamping, gravityScale, particleCone, fadeRate, 
                .5, 0, 1              // randomness, collide, additive, randomColorLinear, renderOrder
            );
        }
    }

    if (removedCount)
    {
        score += ++comboCount*removedCount;
        fallTimer.set();
    }
    else
        comboCount = 0;
}