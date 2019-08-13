# dotfiles

Not technically "dot" files, but configuration (etc) files that are helpful when settings up a new computer.

# New Macbook setup checklist

* [ ] Download Iterm2 https://www.iterm2.com/downloads.html
* [ ] Install Homebrew https://brew.sh/
* [ ] `brew install fish`
   * [ ] `which fish`
   * [ ] `sudo vi /etc/shells` and add fish's full path
   * [ ] `chsh -s /usr/local/bin/fish`
   * [ ] `curl https://git.io/fisher --create-dirs -sLo ~/.config/fish/functions/fisher.fish` install fisher manager
* [ ] (install nvm)
   * [ ] `fisher add FabioAntunes/fish-nvm`
   * [ ] `fisher add edc/bass`
   * [ ] `nvm install --lts 10`
   * [ ] `nvm install 12`
   * [ ] `nvm install 8`
   * [ ] `nvm install 6`
* [ ] `brew install git`
* [ ] `brew install yarn`
* [ ] Set up SSH key for GitHub, `ssh-keygen -t rsa -b 4096 -C 'carl.vitullo@gmail.com'`
* [ ] `git clone git@github.com:vcarl/dotfiles.git`
* [ ] `cp -r dotfiles/fish/* ~/.config/fish`
* [ ] Import iterm color scheme (Profile > colors > color presets > import)
* [ ] `cp dotfiles/iterm.profile ~/Library/Application\ Support/iTerm2/DynamicProfiles/`
* [ ] Enable Iterm hotkey window
* [ ] Install node LTS https://nodejs.org/en/download/
* [ ] Install VS Code https://code.visualstudio.com/download
   * [ ] Install Sublime keymap
* [ ] Install Sublime Text https://www.sublimetext.com/3
   * [ ] `ln -s /Applications/Sublime\ Text.app/Contents/SharedSupport/bin/subl /usr/local/bin/subl`
* [ ] OSX settings:
   * [ ] Medium click, silent clicking.  No tap to click.
   * [ ] No natural scrolling, 3 finger swipe between pages, 4 finger between screens. No Notification Center or Launchpad
   * [ ] Fastest keyboard repeat, third shortest delay. Use standard function keys
   * [ ] Don't correct spelling, capitalize words, or add a period automatically. **Don't use smart quotes**, remove all text replacements.
   * [ ] Require password immediately after sleep
   * [ ] Turn off "switch to space when switching applications" and "automatically rearrange spaces" under Mission Control


## Fish functions

http://fishshell.com/docs/current/tutorial.html#tut_functions

They live in `~/.config/`. `export.fish` adds a bash-style export, so scripts are more likely to work correctly.
