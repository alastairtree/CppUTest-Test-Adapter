import * as vscode from 'vscode';
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, RetireEvent } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { loadTests, runTests } from './cpputest'
import *  as fs from 'fs';

/**
 * This class is intended as a starting point for implementing a "real" TestAdapter.
 * The file `README.md` contains further instructions.
 */
export class CppUTestAdapter implements TestAdapter {

	private disposables: { dispose(): void }[] = [];

	private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
	private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
	private readonly autorunEmitter = new vscode.EventEmitter<RetireEvent>();

	get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
	get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
	get retire(): vscode.Event<RetireEvent> | undefined { return this.autorunEmitter.event; }

	constructor(
		public readonly workspace: vscode.WorkspaceFolder,
		private readonly log: Log
	) {

		this.log.info('Initializing adapter');

		this.disposables.push(this.testsEmitter);
		this.disposables.push(this.testStatesEmitter);
		this.disposables.push(this.autorunEmitter);

		const runner: string | undefined = vscode.workspace.getConfiguration("cpputestExplorer").testExecutable;
		fs.watchFile(<fs.PathLike>runner, (cur: fs.Stats, prev: fs.Stats) => {
			if(cur.mtimeMs !== prev.mtimeMs)
			{
				this.log.info("Executable changed, updating test cases");
				this.load();
				this.autorunEmitter.fire();
			}
		})

	}

	async load(): Promise<void> {

		this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });
		this.log.info('Loading tests');

		const loadedTests = await loadTests();
		this.log.info('Tests loaded');

		this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: loadedTests });

	}

	async run(tests: string[]): Promise<void> {

		this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });
		this.log.info('Running tests');
		await runTests(tests, this.testStatesEmitter);
		this.log.info('Done');
		this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });

	}

/*	implement this method if your TestAdapter supports debugging tests
	async debug(tests: string[]): Promise<void> {
		// start a test run in a child process and attach the debugger to it...
	}
*/

	cancel(): void {
		// in a "real" TestAdapter this would kill the child process for the current test run (if there is any)
		throw new Error("Method not implemented.");
	}

	dispose(): void {
		this.cancel();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
	}
}