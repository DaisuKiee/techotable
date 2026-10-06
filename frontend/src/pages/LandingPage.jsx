import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import ctuBg1 from '../assets/images/backgrounds/ctu-bg.png';
import ctuBg2 from '../assets/images/backgrounds/662332107_1498119255017069_2427715418324433071_n.jpg';
import ctuBg3 from '../assets/images/backgrounds/680448563_4304916549747910_4856050542134784312_n.jpg';
import ctuBg4 from '../assets/images/backgrounds/682398065_803515886114740_8967130645743866506_n.jpg';
import ctuBg5 from '../assets/images/backgrounds/685213306_1328240422552832_8939830790887051502_n.jpg';

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const heroImages = [ctuBg1, ctuBg2, ctuBg3, ctuBg4, ctuBg5];

  const handleNavigateToLogin = () => {
    setNavigating(true);
    setTimeout(() => {
      navigate('/signup');
    }, 800);
  };



  // Preloader effect with fade transition
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true); // Start fade out animation
    }, 1800); // Start fading at 1.8 seconds

    const hideTimer = setTimeout(() => {
      setLoading(false); // Remove preloader
      // Trigger hero animation after preloader
      setTimeout(() => setHeroVisible(true), 50);
    }, 2200); // Complete removal at 2.2 seconds

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Show preloader
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 flex items-center justify-center z-50 px-4">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Animated Logo */}
          <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-yellow-400 rounded-full blur-3xl opacity-40 animate-pulse"></div>
            <img 
              src={ctuLogo} 
              alt="CTU Logo" 
              className="w-24 h-24 sm:w-32 sm:h-32 object-contain relative z-10 animate-bounce mx-auto"
            />
          </div>
          
          {/* Loading Text */}
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-transparent mb-3 sm:mb-4">
            CTU Daanbantayan
          </h2>
          <p className="text-sm sm:text-base text-gray-300 mb-6 sm:mb-8">Smart Timetabling System</p>
          
          {/* Spinner */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 text-white overflow-hidden">
      {/* Navigation Loading Overlay */}
      {navigating && (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 z-50 flex items-center justify-center px-4">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative mb-4 sm:mb-6">
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-3xl opacity-40 animate-pulse"></div>
              <img 
                src={ctuLogo} 
                alt="CTU Logo" 
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain relative z-10 animate-bounce"
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-blue-900/80 backdrop-blur-xl border-b border-yellow-400/20 shadow-lg' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <img src={ctuLogo} alt="CTU Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-transparent">
                  CTU Daanbantayan
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-300">Smart Timetabling</p>
              </div>
            </div>

            <button
              onClick={handleNavigateToLogin}
              className="group relative px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-blue-700 hover:from-yellow-500 hover:to-yellow-600 rounded-xl font-semibold overflow-hidden hover:shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300"
            >
              <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                Get Started
                <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Slideshow */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Slideshow Background */}
        <div className={`absolute inset-0 transition-transform duration-1000 ease-out ${
          heroVisible ? 'scale-100' : 'scale-110'
        }`}>
          {heroImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ backgroundImage: `url(${image})` }}
            >
              {/* Lighter overlay - images more visible */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950/60 via-blue-950/50 to-slate-950/60"></div>
              {/* Bottom blend overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-950"></div>
            </div>
          ))}
          
          {/* Slideshow Indicators */}
          <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-1.5 sm:gap-2">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'w-6 sm:w-8 bg-yellow-400' 
                    : 'w-1.5 sm:w-2 bg-white/40 hover:bg-yellow-400/60'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Hero Content - Centered */}
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center py-20 sm:py-24 lg:py-32 transition-all duration-1000 ease-out ${
          heroVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}>
          <div className="max-w-4xl mx-auto">
            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black mb-4 sm:mb-6 leading-tight px-2">
              <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent drop-shadow-2xl">
                The Future of
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-yellow-400 to-blue-400 bg-clip-text text-transparent drop-shadow-2xl">
                Academic Scheduling
              </span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-100 mb-8 sm:mb-10 leading-relaxed drop-shadow-lg max-w-3xl mx-auto px-4">
              Transform your institution with intelligent, AI-powered timetabling. 
              <span className="text-yellow-300 font-semibold"> Save hours, eliminate conflicts, optimize resources.</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
