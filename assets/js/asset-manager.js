/* asset-manager.js
 * Handles saving new/edited assets to localStorage.
 */
(() => {
    const LS_KEY = 'CUSTOM_ASSETS_V1'; // localStorage key
  
    // === UPDATED: Element list ===
    const els = {
      // Form Fields
      lineSection: document.getElementById('line_section'),
      assetId: document.getElementById('asset_id'),
      manufCodePillow: document.getElementById('manuf_code_pillow'),
      manufPillow: document.getElementById('manuf_pillow'),
      manufCodeBearing: document.getElementById('manuf_code_bearing'),
      manufBearing: document.getElementById('manuf_bearing'),
      bearingType: document.getElementById('bearing_type'),
      lubeType: document.getElementById('lube_type'),
      greaseFittingPos: document.getElementById('grease_fitting_pos'),
      bearingVolume: document.getElementById('bearing_volume'),
      fillPercent: document.getElementById('fill_percent'),
      fillGrams: document.getElementById('fill_grams'),
      lubeGreaseG: document.getElementById('lube_grease_g'),
      lubePeriodWeeks: document.getElementById('lube_period_weeks'),
      lubPointId: document.getElementById('lub_point_id'),
      orientationPoint: document.getElementById('orientation_point'),
  
      // Photo
      photo: document.getElementById('asset_photo'),
      previewWrap: document.getElementById('photo_preview_wrap'),
      preview: document.getElementById('photo_preview'),
  
      // Buttons
      save: document.getElementById('btnSave'),
      cancel: document.getElementById('btnCancel')
    };
  
    let currentPhotoData = null; // To hold the Base64 string of the image
  
    // --- Toast helper (copied from your other files) ---
    function toast(msg, type = 'info', ms = 2000) {
      if (window.appCore?.showToast) {
        window.appCore.showToast(msg, type, ms);
        return;
      }
      console.log(`[${type}] ${msg}`);
    }
  
    // --- Photo Preview ---
    function handlePhotoPreview() {
      const file = els.photo.files[0];
      if (!file) {
        currentPhotoData = null;
        els.previewWrap.classList.add('hidden');
        return;
      }
  
      const reader = new FileReader();
      reader.onload = (e) => {
        currentPhotoData = e.target.result; // This is the Base64 string
        els.preview.src = currentPhotoData;
        els.previewWrap.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  
    // --- UPDATED: Clear Form ---
    function clearForm() {
      els.lineSection.value = '';
      els.assetId.value = '';
      els.manufCodePillow.value = '';
      els.manufPillow.value = '';
      els.manufCodeBearing.value = '';
      els.manufBearing.value = '';
      els.bearingType.value = '';
      els.lubeType.value = 'Grease';
      els.greaseFittingPos.value = '';
      els.bearingVolume.value = '0';
      els.fillPercent.value = '0';
      els.fillGrams.value = '0';
      els.lubeGreaseG.value = '0';
      els.lubePeriodWeeks.value = '0';
      els.lubPointId.value = '';
      els.orientationPoint.value = 'Driven Side';
      
      els.photo.value = null; // Clear file input
      currentPhotoData = null;
      els.previewWrap.classList.add('hidden');
      els.preview.src = '';
      
      els.assetId.disabled = false;
      els.save.textContent = 'Save Asset';
      els.cancel.classList.add('hidden');
    }
  
    // --- UPDATED: Save Asset ---
    function saveAsset() {
      const assetId = els.assetId.value.trim();
      
      // --- Validation ---
      if (!assetId) {
        toast('Equipment / Asset ID is mandatory.', 'error');
        els.assetId.focus();
        return;
      }
      if (!currentPhotoData) {
        toast('A photo is mandatory. Please upload an image.', 'error');
        els.photo.focus();
        return;
      }
  
      // --- UPDATED: Build Asset Object ---
      // This now matches your new form fields.
      const asset = {
        'id': assetId, // The unique key for editing/deleting
        'Line Section': els.lineSection.value.trim(),
        'Equipment / Asset ID': assetId,
        'Manufacturer Code Pillow Block': els.manufCodePillow.value.trim(),
        'Manufacturer Pillow Block': els.manufPillow.value.trim(),
        'Manufacturer Code Bearing': els.manufCodeBearing.value.trim(),
        'Manufacturer Bearing': els.manufBearing.value.trim(),
        'Bearing Type': els.bearingType.value.trim(),
        'Lubricant Type': els.lubeType.value,
        'Grease Fitting Position': els.greaseFittingPos.value.trim(),
        'Bearing Volume': Number(els.bearingVolume.value) || 0,
        'Pillow Block 1st Fill %': Number(els.fillPercent.value) || 0,
        'Pillow Block 1st Fill g': Number(els.fillGrams.value) || 0,
        'Lubrication Grease (g)': Number(els.lubeGreaseG.value) || 0,
        'Lubrication Period (weeks)': Number(els.lubePeriodWeeks.value) || 0,
        'Lub Point ID': els.lubPointId.value.trim(),
        'Orientation Point': els.orientationPoint.value,
        
        // The most important part: save the image as a text string
        'photoData': currentPhotoData 
      };
  
      // --- Save to localStorage (This logic remains the same) ---
      try {
        let list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        
        // Check if editing or adding
        const existingIndex = list.findIndex(a => a.id === asset.id);
        
        if (existingIndex > -1) {
          // Update existing
          list[existingIndex] = asset;
          toast('Asset Updated Successfully!', 'info');
        } else {
          // Add new
          list.push(asset);
          toast('New Asset Saved Successfully!', 'info');
        }
  
        localStorage.setItem(LS_KEY, JSON.stringify(list));
        
        // Also update the 'asset list' used by dropdowns
        // UPDATED: This now maps the correct field name
        const assetNameList = list.map(a => a['Equipment / Asset ID']);
        localStorage.setItem('QAQC_ASSET_LIST', JSON.stringify(assetNameList));
  
        clearForm();
  
      } catch (e) {
        console.error(e);
        toast('Error saving asset. Storage might be full.', 'error');
      }
    }
  
    // --- Init ---
    function init() {
      els.photo.addEventListener('change', handlePhotoPreview);
      els.save.addEventListener('click', saveAsset);
      els.cancel.addEventListener('click', clearForm);
    }
    
    document.addEventListener('DOMContentLoaded', init);
  })();