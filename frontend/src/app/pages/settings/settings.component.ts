import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Settings } from '../../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService);

  settings = signal<Settings | null>(null);
  saved = signal(false);
  form: Partial<Settings> = {};

  ngOnInit(): void {
    this.api.getSettings().subscribe((s) => {
      this.settings.set(s);
      this.form = { ...s };
    });
  }

  save(): void {
    this.api.updateSettings(this.form).subscribe((s) => {
      this.settings.set(s);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
    });
  }
}
