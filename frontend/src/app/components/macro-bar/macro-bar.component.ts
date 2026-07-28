import { Component, Input, computed, input } from '@angular/core';
import { MacroProgress } from '../../models';

@Component({
  selector: 'app-macro-bar',
  standalone: true,
  templateUrl: './macro-bar.component.html',
  styleUrl: './macro-bar.component.scss',
})
export class MacroBarComponent {
  macro = input.required<MacroProgress>();

  fillPercent = computed(() => {
    const m = this.macro();
    const midTarget = (m.min + m.max) / 2;
    const percent = Math.min((m.current / midTarget) * 100, 100);
    return Math.max(0, percent);
  });
}
