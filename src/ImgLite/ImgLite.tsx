import { isMobile } from 'is-mobile'
import debounce from 'lodash/debounce'
import queryString from 'query-string'
import React, {
  forwardRef,
  memo,
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import * as S from './ImgLite.styles'

type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

type Gravity =
  | 'center'
  | 'entropy'
  | 'attention'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'

export interface ImgLiteOwnProps {
  className?: string
  fit?: Fit
  gravity?: Gravity
  density?: number
  height?: number
  lowResQuality?: number
  lowResWidth?: number
  quality?: number
  sharpen?: string
  sizingStep?: number
  src: string
  width?: number
}

type ImgLiteProps = ImgLiteOwnProps &
  (Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'children'> | React.HTMLAttributes<HTMLDivElement>)

interface ImgLiteThumbnailOptions {
  fit?: Fit
  gravity?: Gravity
  height?: number
  width?: number
  quality?: number
  sharpen?: string
  webp?: boolean
}

const AUTO_DENSITY = isMobile() ? 1.5 : 1

function getMaxSize(size: number, density = AUTO_DENSITY, sizingStep = 100) {
  return Math.ceil((size * density) / sizingStep) * sizingStep
}

function thumbnail(url: string, options: ImgLiteThumbnailOptions = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development' && url && !/^http/i.test(url)
  const isBlobOrDataUrl = url && /^(blob|data):/i.test(url)
  const isSvg = url && /\.svg$/.test(url)

  if (!url || isDevelopment || isSvg || isBlobOrDataUrl) {
    return url
  }

  // temporary removal of ImageKit url part
  const sanitizedUrl = url.replace('https://ik.imagekit.io/avantstay/', '').replace(/^\//, '')
  const baseUrl = `https://imglite.avantstay.com/${encodeURIComponent(sanitizedUrl)}`

  return queryString.stringifyUrl({ url: baseUrl, query: options as any }, { skipEmptyString: true })
}

function setRefCurrent(ref: React.Ref<any>, value: any) {
  if (!ref) return

  const mutableRef = ref as MutableRefObject<any>
  mutableRef.current = value
}

function useForwardedRef<E, T extends React.Ref<E>>(externalRef: T) {
  return useMemo((): React.Ref<E> => {
    const internalRef = ((element: E) => {
      setRefCurrent(internalRef, element)

      if (typeof externalRef === 'function') {
        ;(externalRef as React.RefCallback<E>)(element)
      } else {
        setRefCurrent(externalRef, element)
      }
    }) as React.Ref<E>

    setRefCurrent(internalRef, null)

    return internalRef
  }, [externalRef])
}

const supportsWebP = (() => {
  return new Promise<boolean>(resolve => {
    const WebP = new Image()
    WebP.onload = WebP.onerror = () => resolve(WebP.height === 2)
    WebP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
  })
})()

function _ImgLite(
  {
    fit,
    gravity,
    density,
    height,
    lowResQuality = 30,
    lowResWidth,
    quality,
    sharpen,
    sizingStep,
    src,
    width,
    ...otherProps
  }: ImgLiteProps,
  ref: React.Ref<HTMLDivElement> | React.Ref<HTMLImageElement>
) {
  const [currentImage, setCurrentImage] = useState<string>()
  const imageRef = useForwardedRef(ref)

  const loadImage = useCallback((src: string) => {
    const image = new Image()
    image.onload = () => setCurrentImage(src)
    image.src = src
  }, [])

  const updateCurrentImage = useCallback(
    (supportsWebP = false) => {
      const imageElement = (imageRef as RefObject<HTMLElement>).current

      const elementHeight = imageElement ? imageElement.offsetHeight : 0
      const elementWidth = imageElement ? imageElement.offsetWidth : 0

      const maxHeight = height || getMaxSize(elementHeight, density, sizingStep)
      const maxWidth = width || getMaxSize(elementWidth, density, sizingStep)

      if (!maxHeight || !maxWidth) return

      const thumbnailOptions = {
        fit,
        webp: supportsWebP,
        gravity,
        height: maxHeight,
        width: maxWidth,
        quality,
        sharpen,
      }
      const newSrc = thumbnail(src, thumbnailOptions)

      if (currentImage) {
        loadImage(newSrc)
        return
      }

      if (lowResWidth) {
        const lowResolutionThumbnailOptions = {
          ...thumbnailOptions,
          maxHeight: undefined,
          maxWidth: lowResWidth,
          quality: lowResQuality,
        }

        setCurrentImage(thumbnail(src, lowResolutionThumbnailOptions))
        loadImage(newSrc)
        return
      }

      setCurrentImage(newSrc)
    },
    [
      currentImage,
      density,
      fit,
      gravity,
      height,
      imageRef,
      loadImage,
      lowResQuality,
      lowResWidth,
      quality,
      sharpen,
      sizingStep,
      src,
      width,
    ]
  )

  useLayoutEffect(() => {
    supportsWebP.then(webp => updateCurrentImage(webp))
  }, [updateCurrentImage])

  useEffect(() => {
    const debouncedUpdateCurrentImage = debounce(() => supportsWebP.then(webp => updateCurrentImage(webp)), 200)
    window.addEventListener('resize', debouncedUpdateCurrentImage)

    return () => {
      window.removeEventListener('resize', debouncedUpdateCurrentImage)
    }
  }, [updateCurrentImage])

  const ImageComponent = 'children' in otherProps && otherProps.children ? S.Background : S.Image
  return <ImageComponent ref={imageRef as any} src={currentImage} {...otherProps} />
}

export default memo(forwardRef(_ImgLite))
