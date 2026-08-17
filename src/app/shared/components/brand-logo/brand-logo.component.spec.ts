/**
 * Unit tests for BrandLogoComponent.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrandLogoComponent } from './brand-logo.component';

describe('BrandLogoComponent', () => {
  let component: BrandLogoComponent;
  let fixture: ComponentFixture<BrandLogoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandLogoComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render both theme variants as decorative images', () => {
    fixture.detectChanges();

    const imgs = fixture.nativeElement.querySelectorAll('img');
    expect(imgs.length).toBe(2);

    const onDark = fixture.nativeElement.querySelector('.brand-logo__img--on-dark');
    const onLight = fixture.nativeElement.querySelector('.brand-logo__img--on-light');

    expect(onDark?.getAttribute('src')).toBe('brand-logo-light.png');
    expect(onLight?.getAttribute('src')).toBe('brand-logo.png');
    expect(onDark?.getAttribute('alt')).toBe('');
    expect(onLight?.getAttribute('aria-hidden')).toBe('true');
    expect(onDark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should bind the size input to the rendered height', () => {
    fixture.componentRef.setInput('size', 40);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.brand-logo__img--on-dark');
    expect(img?.style.height).toBe('40px');
  });
});
