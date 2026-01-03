/**
 * [INPUT]: utils.ts functions
 * [OUTPUT]: Unit tests for utility functions
 * [POS]: 测试工具函数
 */

import { describe, it, expect } from 'vitest';
import { cn, isImageFile } from './utils';

describe('cn (class name merger)', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
  });

  it('merges tailwind classes correctly', () => {
    // tailwind-merge 应该合并冲突的类
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles array of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles object syntax', () => {
    expect(cn({ active: true, hidden: false })).toBe('active');
  });
});

describe('isImageFile', () => {
  it('returns true for common image extensions', () => {
    expect(isImageFile('photo.png')).toBe(true);
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
    expect(isImageFile('photo.gif')).toBe(true);
    expect(isImageFile('photo.webp')).toBe(true);
    expect(isImageFile('photo.svg')).toBe(true);
    expect(isImageFile('photo.ico')).toBe(true);
    expect(isImageFile('photo.bmp')).toBe(true);
    expect(isImageFile('photo.tiff')).toBe(true);
    expect(isImageFile('photo.avif')).toBe(true);
  });

  it('returns true for uppercase extensions', () => {
    expect(isImageFile('PHOTO.PNG')).toBe(true);
    expect(isImageFile('PHOTO.JPG')).toBe(true);
    expect(isImageFile('Photo.Jpeg')).toBe(true);
  });

  it('returns false for non-image extensions', () => {
    expect(isImageFile('document.pdf')).toBe(false);
    expect(isImageFile('script.js')).toBe(false);
    expect(isImageFile('style.css')).toBe(false);
    expect(isImageFile('data.json')).toBe(false);
    expect(isImageFile('readme.md')).toBe(false);
  });

  it('returns false for files without extension', () => {
    expect(isImageFile('Makefile')).toBe(false);
    expect(isImageFile('README')).toBe(false);
  });

  it('handles paths with directories', () => {
    expect(isImageFile('/path/to/image.png')).toBe(true);
    expect(isImageFile('src/assets/logo.svg')).toBe(true);
  });

  it('handles files with multiple dots', () => {
    expect(isImageFile('image.backup.png')).toBe(true);
    expect(isImageFile('archive.tar.gz')).toBe(false);
  });
});
