import { test, expect, Page, Locator, FileChooser } from '@playwright/test';
import { getPathToJsonFile, getUrl } from './config.js';

async function enterSubgraph(page: Page, nodeWithSubgraph: Locator) {
    await nodeWithSubgraph.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Edit Subgraph');
    await contextMenuOption.click();
}

async function openFileChooser(
    page: Page,
    purpose: 'specification' | 'dataflow',
): Promise<FileChooser> {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.mouse.move(25, 25);
    let text = '';
    if (purpose === 'specification') {
        text = 'Load specification';
    } else if (purpose === 'dataflow') {
        text = 'Load graph file';
    }
    await page.getByText(text).click();
    const fileChooser = await fileChooserPromise;
    return fileChooser;
}

async function loadSubgraphSpecification(page: Page) {
    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(getPathToJsonFile('sample-subgraph-specification.json'));
}

async function loadSubgraphDataflow(page: Page) {
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(getPathToJsonFile('sample-subgraph-dataflow.json'));
}

test('test loading subgraph dataflow', async ({ page }) => {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);
    let nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);
});

test('test entering subgraph', async ({ page }) => {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);

    // There are four nodes initially.
    let nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);

    // A subgraph contains two nodes.
    expect(await nodes.count()).toBe(2);
});

test('test coming back from subgraph', async ({ page }) => {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);

    // Initially, there are four nodes.
    const nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);
    // A subgraph contains two nodes.
    expect(await nodes.count()).toBe(2);

    // Leave the subgraph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
    expect(await nodes.count()).toBe(4);
});

async function dragAndDrop(page: Page, locator: Locator, to: { x: number; y: number }) {
    await locator.hover();
    await page.mouse.down();
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
}

test('test preserving changes to subgraph', async ({ page }) => {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);

    const nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);
    expect(await nodes.count()).toBe(2);

    // Add a new node: open the node browser, expand a category, and drag & drop a node.
    const showNodesButton = page.getByText('Show node browser').locator('../..');
    await showNodesButton.click();

    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();

    const nodeFromBrowser = page.getByText('Test node #').first();
    await dragAndDrop(page, nodeFromBrowser, { x: 400, y: 200 });
    expect(await nodes.count()).toBe(3);

    // Get back to the main graph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();

    // Enter the subgraph, it should have the same node count.
    await enterSubgraph(page, nodeContainingSubgraph);
    expect(await nodes.count()).toBe(3);
});

test('test visibility of newly exposed subgraph interface', async ({ page }) => {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);

    // Initially, there are 4 interfaces exposed.
    const initialInterfaceCount = 4;
    const nodeWithSubgraph = page.getByText('Test subgraph node #1').locator('../..');
    const outputs = nodeWithSubgraph.locator('.__outputs > div');
    expect(await outputs.count()).toBe(initialInterfaceCount);

    // Enter a subgraph.
    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);

    // Add a new node: open the node browser, expand a category, and drag & drop a node.
    const showNodesButton = page.getByText('Show node browser').locator('../..');
    await showNodesButton.click();

    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();

    const nodeFromBrowser = page.getByText('Test node #').first();
    await dragAndDrop(page, nodeFromBrowser, { x: 400, y: 200 });

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const newOutputInterface = page
        .getByText('Test node #1')
        .locator('../..')
        .locator('.__content .__port')
        .nth(4);
    await newOutputInterface.click({ button: 'right' });

    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Expose Interface');
    await contextMenuOption.click();

    // Get back to the main graph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();

    // Check if the newly exposed interface is present.
    expect(await outputs.count()).toBe(initialInterfaceCount + 1);
});

test("test hiding and exposing subgraph's interface", async ({ page }) => {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);

    // Initially, there are 4 interfaces exposed.
    const initialInterfaceCount = 4;
    const nodeWithSubgraph = page.getByText('Test subgraph node #1').locator('../..');
    const exposedInterfaces = nodeWithSubgraph.locator('.__outputs > div');
    expect(await exposedInterfaces.count()).toBe(initialInterfaceCount);

    // Enter a subgraph.
    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);

    // Hide an exposed interface: invoke a interface's context menu and click the option.
    const exposedInterface = page
        .getByText('Test node #1')
        .locator('../..')
        .locator('.__content .__port')
        .nth(1);
    await exposedInterface.click({ button: 'right' });

    const privatizeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Privatize Interface');
    await privatizeContextMenuOption.click();

    // Get back to the main graph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
    expect(await exposedInterfaces.count()).toBe(initialInterfaceCount - 1);

    // Re-expose the currently hidden interface: invoke an interface's context menu and click the option.
    await enterSubgraph(page, nodeContainingSubgraph);
    await exposedInterface.click({ button: 'right' });
    const exposeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Expose Interface');
    await exposeContextMenuOption.click();

    // Get back to the main graph.
    await leaveButton.click();
    expect(await exposedInterfaces.count()).toBe(initialInterfaceCount);
});
