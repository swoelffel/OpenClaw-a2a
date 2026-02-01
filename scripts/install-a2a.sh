#!/bin/bash

# OpenClaw A2A Extension Installer
# Usage: ./install-a2a.sh [version]
# Exemple: ./install-a2a.sh v0.1.0
# Si aucune version n'est spécifiée, installe la dernière release

set -e

# Configuration
REPO_OWNER="swoelffel"
REPO_NAME="OpenClaw-a2a"
EXTENSION_NAME="a2a"
INSTALL_DIR="${HOME}/.openclaw/extensions/${EXTENSION_NAME}"
BACKUP_DIR="${HOME}/.openclaw/extensions/.backups"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions de logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier les dépendances
check_dependencies() {
    log_info "Vérification des dépendances..."
    
    if ! command -v curl &> /dev/null; then
        log_error "curl est requis mais n'est pas installé"
        exit 1
    fi
    
    if ! command -v tar &> /dev/null; then
        log_error "tar est requis mais n'est pas installé"
        exit 1
    fi
    
    log_success "Dépendances OK"
}

# Obtenir la dernière version
get_latest_version() {
    log_info "Recherche de la dernière version..."
    
    local latest_release
    latest_release=$(curl -s "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$latest_release" ]; then
        log_error "Impossible de trouver la dernière version"
        exit 1
    fi
    
    echo "$latest_release"
}

# Télécharger l'extension
download_extension() {
    local version=$1
    local download_url="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/openclaw-a2a-extension.tar.gz"
    local temp_dir=$(mktemp -d)
    local archive_path="${temp_dir}/openclaw-a2a-extension.tar.gz"
    
    log_info "Téléchargement de la version ${version}..."
    
    if ! curl -L -o "$archive_path" "$download_url"; then
        log_error "Échec du téléchargement depuis ${download_url}"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_success "Téléchargement terminé"
    echo "$temp_dir"
}

# Sauvegarder l'installation existante
backup_existing() {
    if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR")" ]; then
        log_warning "Extension existante détectée, création d'une sauvegarde..."
        
        mkdir -p "$BACKUP_DIR"
        local backup_name="${EXTENSION_NAME}-$(date +%Y%m%d-%H%M%S).tar.gz"
        
        tar -czf "${BACKUP_DIR}/${backup_name}" -C "$INSTALL_DIR" .
        log_success "Sauvegarde créée: ${BACKUP_DIR}/${backup_name}"
    fi
}

# Installer l'extension
install_extension() {
    local temp_dir=$1
    local archive_path="${temp_dir}/openclaw-a2a-extension.tar.gz"
    
    log_info "Installation de l'extension..."
    
    # Créer le répertoire d'installation
    mkdir -p "$INSTALL_DIR"
    
    # Extraire l'archive
    if ! tar -xzf "$archive_path" -C "$INSTALL_DIR"; then
        log_error "Échec de l'extraction de l'archive"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Nettoyer
    rm -rf "$temp_dir"
    
    log_success "Extension installée dans ${INSTALL_DIR}"
}

# Vérifier l'installation
verify_installation() {
    log_info "Vérification de l'installation..."
    
    if [ ! -f "${INSTALL_DIR}/dist/index.js" ]; then
        log_error "Fichier principal manquant: dist/index.js"
        exit 1
    fi
    
    if [ ! -f "${INSTALL_DIR}/openclaw.plugin.json" ]; then
        log_error "Fichier de configuration manquant: openclaw.plugin.json"
        exit 1
    fi
    
    log_success "Installation vérifiée"
}

# Redémarrer OpenClaw gateway
restart_gateway() {
    log_info "Redémarrage d'OpenClaw Gateway..."
    
    if command -v openclaw &> /dev/null; then
        if openclaw gateway restart; then
            log_success "Gateway redémarré avec succès"
        else
            log_warning "Impossible de redémarrer le gateway automatiquement"
            log_info "Redémarrez manuellement avec: openclaw gateway restart"
        fi
    else
        log_warning "Commande 'openclaw' non trouvée"
        log_info "Redémarrez manuellement le gateway OpenClaw"
    fi
}

# Afficher les informations de l'installation
show_info() {
    echo ""
    echo "=========================================="
    log_success "Installation terminée avec succès !"
    echo "=========================================="
    echo ""
    echo -e "${BLUE}Emplacement:${NC} ${INSTALL_DIR}"
    echo -e "${BLUE}Version:${NC} ${VERSION}"
    echo -e "${BLUE}Fichiers installés:${NC}"
    ls -la "$INSTALL_DIR"
    echo ""
    echo -e "${YELLOW}Configuration:${NC}"
    echo "  L'extension est automatiquement configurée dans:"
    echo "  ~/.openclaw/config.json"
    echo ""
    echo -e "${YELLOW}Documentation:${NC}"
    echo "  https://github.com/${REPO_OWNER}/${REPO_NAME}"
    echo ""
    echo -e "${YELLOW}Commandes utiles:${NC}"
    echo "  openclaw gateway status    # Vérifier le statut"
    echo "  openclaw gateway restart   # Redémarrer le gateway"
    echo ""
}

# Fonction principale
main() {
    echo "=========================================="
    echo "  OpenClaw A2A Extension Installer"
    echo "=========================================="
    echo ""
    
    # Vérifier les arguments
    if [ $# -eq 0 ]; then
        log_info "Aucune version spécifiée, utilisation de la dernière release"
        VERSION=$(get_latest_version)
    else
        VERSION=$1
    fi
    
    log_info "Version à installer: ${VERSION}"
    
    # Exécuter les étapes d'installation
    check_dependencies
    backup_existing
    TEMP_DIR=$(download_extension "$VERSION")
    install_extension "$TEMP_DIR"
    verify_installation
    restart_gateway
    show_info
    
    log_success "Installation complète !"
}

# Gestion des erreurs
trap 'log_error "Une erreur est survenue lors de l installation"; exit 1' ERR

# Exécution
main "$@"
