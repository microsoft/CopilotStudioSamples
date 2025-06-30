"use client";

import { useEffect } from "react";

export function CitationLinkHandler() {
  useEffect(() => {
    // Function that finds citation links and makes them open in new tabs
    const processCitationLinks = () => {
      // Target the specific class combination used for citation links
      document.querySelectorAll('a.text-primary.font-medium.underline.underline-offset-4').forEach(link => {
        if (link instanceof HTMLAnchorElement) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });
    };

    // Run immediately on component mount
    processCitationLinks();

    // Set up mutation observer to catch dynamically added links
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          shouldProcess = true;
        }
      });
      
      if (shouldProcess) {
        processCitationLinks();
      }
    });

    // Start observing the document body for added nodes
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Cleanup when component unmounts
    return () => observer.disconnect();
  }, []);

  return null; // This component doesn't render anything
}