import { Component, h, Prop, State, Event, EventEmitter, Element, Method } from '@stencil/core';
import { AppConfig, KeyboardConfig } from '../../utils/types';
import { APP_NAME, APP_DESCRIPTION, APP_VERSION, SettingsTab } from '../../utils/constants';

/**
 * Global config object managed by the host application (ot-app).
 * Declared here so TypeScript is aware of it.
 */
declare const appConfig: AppConfig;

/**
 * Settings panel component.
 *
 * Provides tabbed UI for:
 *  - Keyboard shortcut customisation
 *  - Advanced / JSON config editing
 *  - About page (rebranded to OpenTrace)
 *
 * All licensing / activation functionality has been removed.
 */
@Component({
  tag: 'ot-settings',
  styleUrl: 'ot-settings.css',
  shadow: true,
})
export class OtSettings {
  @Element() el!: HTMLElement;

  // ------------------------------------------------------------------ Props

  /** The application config object (passed by reference from the host). */
  @Prop() config: AppConfig | null = null;

  // ------------------------------------------------------------------ State

  /** Whether the settings window is visible. */
  @State() visible: boolean = false;

  /** Whether any shortcut field has been edited (enables the Apply button). */
  @State() hasChanges: boolean = false;

  // ----------------------------------------------------------------- Events

  /** Emitted when the user clicks Apply to persist shortcut changes. */
  @Event({ eventName: 'config-save', bubbles: true, composed: true })
  configSave!: EventEmitter<string>;

  /** Emitted to request the host to open the JSON settings file. */
  @Event({ eventName: 'settings-json', bubbles: true, composed: true })
  settingsJson!: EventEmitter<{}>;

  /** Emitted to request the host to reload config from disk. */
  @Event({ eventName: 'config-reload', bubbles: true, composed: true })
  configReload!: EventEmitter<{}>;

  /** Emitted to request the host to reset config to defaults. */
  @Event({ eventName: 'config-reset', bubbles: true, composed: true })
  configReset!: EventEmitter<{}>;

  // ------------------------------------------------------------ Lifecycle

  componentDidLoad() {
    this.setTabTarget('shortcuts');
  }

  // ------------------------------------------------------- Public methods

  /** Show the settings window. */
  @Method()
  async show(): Promise<void> {
    this.visible = true;
  }

  /** Hide the settings window. */
  @Method()
  async hide(): Promise<void> {
    this.visible = false;
  }

  // -------------------------------------------------------- Internal helpers

  /** Resolve the active config, preferring the prop, falling back to the global. */
  private getConfig(): AppConfig {
    return this.config ?? appConfig;
  }

  // -------------------------------------------------------- Tab navigation

  private handleTabClick = (evt: MouseEvent) => {
    const target = (evt.target as HTMLElement)?.getAttribute('data-target') as SettingsTab | null;
    if (target) {
      this.setTabTarget(target);
    }
  };

  private setTabTarget(tab: SettingsTab): void {
    const root = this.el.shadowRoot!;

    // Hide all pages
    root.querySelectorAll<HTMLElement>('.page').forEach((page) => {
      page.style.display = 'none';
    });

    // Show the selected page
    const activePage = root.getElementById(`page-${tab}`);
    if (activePage) {
      activePage.style.display = 'block';
    }

    // Update nav highlights
    root.querySelectorAll<HTMLElement>('.tab-nav ul li').forEach((li) => {
      li.classList.remove('active');
    });
    const activeTab = root.getElementById(`tab-${tab}`);
    if (activeTab) {
      activeTab.classList.add('active');
    }
  }

  // -------------------------------------------------------- Shortcut editing

  private handleEditShortcut = (evt: InputEvent) => {
    const input = evt.target as HTMLInputElement;
    const defaultValue = input.getAttribute('data-default') ?? '';

    if (input.value !== defaultValue) {
      input.classList.add('edited');
    } else {
      input.classList.remove('edited');
    }

    this.hasChanges =
      (this.el.shadowRoot?.querySelectorAll('.edited')?.length ?? 0) > 0;
  };

  // -------------------------------------------------------- Actions

  private handleApply = () => {
    const cfg = this.getConfig();
    const editedInputs = this.el.shadowRoot?.querySelectorAll<HTMLInputElement>('.edited');

    editedInputs?.forEach((input) => {
      const key = input.getAttribute('data-key');
      if (key && key in cfg.keyboard) {
        (cfg.keyboard as Record<string, string | number>)[key] = input.value;
      }
    });

    // Remove edited class after applying
    editedInputs?.forEach((input) => {
      input.classList.remove('edited');
    });

    this.configSave.emit(JSON.stringify(cfg));
    this.hasChanges = false;
    this.closeWindow();
  };

  private closeWindow = () => {
    this.visible = false;
  };

  private handleOpenSettingsJSON = () => {
    this.settingsJson.emit({});
  };

  private handleReloadConfig = () => {
    this.configReload.emit({});
  };

  private handleReloadDefaults = () => {
    this.configReset.emit({});
  };

  // -------------------------------------------------------- Templates

  /**
   * Render a single shortcut row in the keyboard shortcuts table.
   */
  private renderShortcutRow(key: string, value: string) {
    // Convert camelCase key to a human-readable label
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase());

    return (
      <tr>
        <td>{label}</td>
        <td class="shortcut-current">{value}</td>
        <td>
          <input
            id={`shortcut-${key}`}
            class="shortcut-input"
            type="text"
            autocomplete="off"
            spellcheck={false}
            data-key={key}
            data-default={value}
            value={value}
            onInput={this.handleEditShortcut}
          />
        </td>
      </tr>
    );
  }

  // -------------------------------------------------------------- Render

  render() {
    const cfg = this.getConfig();

    return (
      <ot-window title="Settings" backgroundBlur visible={this.visible}>
        <div slot="content" class="tabs">
          {/* -------- Tab navigation -------- */}
          <div class="tab-nav">
            <ul>
              <li id="tab-shortcuts" onClick={this.handleTabClick} data-target="shortcuts">
                <svg><use xlinkHref="#fa-command" /></svg>
                Shortcuts
              </li>
              <li id="tab-advanced" onClick={this.handleTabClick} data-target="advanced">
                <svg><use xlinkHref="#fa-code" /></svg>
                More
              </li>
              <li id="tab-about" onClick={this.handleTabClick} data-target="about">
                <svg><use xlinkHref="#fa-info" /></svg>
                About
              </li>
            </ul>
          </div>

          {/* -------- Shortcuts page -------- */}
          <div id="page-shortcuts" class="page" style={{ padding: '0' }}>
            <table>
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Current</th>
                  <th>New Key</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cfg.keyboard as KeyboardConfig).map(([key, value]) =>
                  this.renderShortcutRow(key, String(value)),
                )}
              </tbody>
            </table>
          </div>

          {/* -------- Advanced / JSON page -------- */}
          <div id="page-advanced" class="page">
            <div class="container">
              <label>JSON</label>
              <button class="btn" onClick={this.handleOpenSettingsJSON}>
                Edit
              </button>
              <button class="btn" onClick={this.handleReloadConfig}>
                Reload
              </button>
              <label>Reset</label>
              <button class="btn" onClick={this.handleReloadDefaults}>
                Reload Defaults
              </button>
            </div>
          </div>

          {/* -------- About page -------- */}
          <div id="page-about" class="page" style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '0' }}>
              <strong>{APP_NAME}</strong>
            </p>
            <p style={{ marginTop: '0' }}>
              <small>{APP_DESCRIPTION}</small>
            </p>
            <p style={{ marginBottom: '0' }}>{APP_VERSION}</p>
          </div>
        </div>

        {/* -------- Bottom action bar -------- */}
        <div slot="actions" id="actions" class="row">
          <button
            class="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={this.handleApply}
            disabled={!this.hasChanges}
          >
            Apply
          </button>
          <button class="btn" onClick={this.closeWindow}>
            Close
          </button>
        </div>
      </ot-window>
    );
  }
}
